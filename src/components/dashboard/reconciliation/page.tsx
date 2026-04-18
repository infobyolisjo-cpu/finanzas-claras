
'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileText, CheckCircle, AlertCircle, XCircle, FileWarning, Inbox, Loader2, Save, Info, BrainCircuit, Lightbulb, ShieldAlert, BarChart, FileCheck2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getUserTransactions, saveImportedTransactions, saveImportedFile, createFileHash, createTransactionHash } from '@/lib/firestore';
import type { Transaction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { format, isValid, parse, isDate, getYear, setYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TRANSACTION_CATEGORIES } from '@/lib/constants';
import { useReconciliation } from '@/context/reconciliation-context';
import { classifyTransactionsAction, analyzeStatementPdfAction } from '@/app/actions';
import { usePeriod } from '@/context/period-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AnalyzeStatementPdfOutput } from '@/ai/types';

type BankTransaction = {
  date: Date;
  description: string;
  amount: number; // Positive for income, negative for expense
  bankType: 'deposit_credit' | 'withdrawal_debit';
  bankSubtype: 'purchase' | 'online_transfer' | 'zelle' | 'atm_withdrawal' | 'bill_payment_or_loan' | 'fee' | 'unknown_debit' | 'none';
};

type ReconciliationResult = {
  bankDate: string | null;
  bankDesc: string | null;
  bankAmount: number | null;
  appDate: string | null;
  appCategory: string | null;
  appAmount: number | null;
  status: 'conciliado' | 'faltante' | 'sobrante' | 'inconsistente';
  importCategory?: string;
};

// Helper function to validate and correct the year of a date
const validateAndCorrectYear = (date: Date): Date => {
  if (!isValid(date)) return date;
  const year = getYear(date);
  if (year < 1900 || year > 2100) {
    console.warn(`Invalid year ${year} detected in date ${date}. Correcting to current year.`);
    return setYear(date, new Date().getFullYear());
  }
  return date;
}

// Helper function to attempt parsing a value as a date
const tryParseDate = (value: any): Date | null => {
  if (!value) return null;
  if (isDate(value) && isValid(value)) return validateAndCorrectYear(value);

  if (typeof value === 'number') {
    const excelDate = XLSX.SSF.parse_date_code(value);
    if (excelDate) {
        const date = new Date(Date.UTC(excelDate.y, excelDate.m - 1, excelDate.d, excelDate.H, excelDate.M, excelDate.S));
        if(isValid(date)) return validateAndCorrectYear(date);
    }
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    const commonFormats = [
      'MM/dd/yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy', 'MM-dd-yyyy', 'dd-MM-yyyy', 'MM/dd/yy', 
      'dd/MM/yy', 'yyyy/MM/dd', 'dd-MMM-yyyy', 'd-MMM-yy', 'M/d/yy', 'M/d/yyyy'
    ];
    for (const fmt of commonFormats) {
      const parsedDate = parse(trimmedValue, fmt, new Date());
      if (isValid(parsedDate)) {
        return validateAndCorrectYear(parsedDate);
      }
    }
  }
  
  return null;
};


// Helper function to attempt parsing a value as a number (amount)
const tryParseAmount = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value === 'string') {
      const cleanedString = value.trim().replace(/\$/g, '').replace(/\((.*)\)/, '-$1').replace(/,/g, '');
      if (cleanedString === '') return null;
      const num = parseFloat(cleanedString);
      return isNaN(num) ? null : num;
    }
    return null;
};

// --- New Inference Logic ---
function inferColumns(data: any[][]): Record<string, number> | null {
    if (!data || data.length < 3) return null; 
    const sample = data.slice(0, Math.min(data.length, 50));
    const numCols = sample.reduce((max, row) => Math.max(max, row.length), 0);

    const scores = Array.from({ length: numCols }, () => ({
        date: 0,
        amount: 0,
        text: 0,
        avgTextLength: 0,
        nonEmptyCount: 0,
    }));

    sample.forEach(row => {
        for (let i = 0; i < numCols; i++) {
            const cell = row[i];
            if (cell === null || cell === undefined || String(cell).trim() === "") continue;
            
            scores[i].nonEmptyCount++;
            if (tryParseDate(cell)) scores[i].date++;
            if (tryParseAmount(cell) !== null) scores[i].amount++;
            if (typeof cell === 'string' && isNaN(Number(cell))) {
                scores[i].text++;
                scores[i].avgTextLength += cell.length;
            }
        }
    });

    scores.forEach(s => s.avgTextLength = s.avgTextLength / (s.text || 1));

    const dateCandidate = scores.map((s,i) => ({...s, index: i})).filter(c => c.date / c.nonEmptyCount > 0.6).sort((a,b) => b.date - a.date)[0];
    const amountCandidate = scores.map((s,i) => ({...s, index: i})).filter(c => c.amount / c.nonEmptyCount > 0.6).sort((a,b) => b.amount - a.amount)[0];
    
    if (!dateCandidate || !amountCandidate) {
        return null;
    }

    const descriptionCandidate = scores
        .map((s,i) => ({...s, index: i}))
        .filter(c => c.index !== dateCandidate.index && c.index !== amountCandidate.index)
        .filter(c => c.text / c.nonEmptyCount > 0.5 && String(data[0][c.index]).trim() !== '*')
        .sort((a, b) => b.avgTextLength - a.avgTextLength)[0];
    
    if (!descriptionCandidate) {
        return null; 
    }
    
    const mapping: Record<string, number> = {
        date: dateCandidate.index,
        amount: amountCandidate.index,
        description: descriptionCandidate.index,
    };
    
    const usedIndexes = Object.values(mapping);
    if (new Set(usedIndexes).size !== usedIndexes.length) {
      return null;
    }
    
    return mapping;
}

function fallbackParse(data: any[][]): Record<string, number> | null {
    if (!data || data.length === 0 || data[0].length < 3) return null;

    const firstRow = data[0];
    // Pattern: Date, Amount, *, Empty, Description
    const isDateCol0 = tryParseDate(firstRow[0]) !== null;
    const isAmountCol1 = tryParseAmount(firstRow[1]) !== null;
    const hasLongText = firstRow.some(cell => typeof cell === 'string' && cell.length > 15);
    
    if (isDateCol0 && isAmountCol1 && hasLongText) {
        // Find description column (longest text)
        let descIndex = -1;
        let maxLength = 0;
        firstRow.forEach((cell, index) => {
            if (typeof cell === 'string' && cell.length > maxLength) {
                maxLength = cell.length;
                descIndex = index;
            }
        });
        if (descIndex !== -1) {
             return { date: 0, amount: 1, description: descIndex };
        }
    }
    return null;
}


function CsvImportTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { bankStatementTransactions, setBankStatementTransactions, setAlerts } = useReconciliation();
  const { refreshTransactions } = usePeriod();

  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ReconciliationResult[] | null>(null);
  const [statementPeriod, setStatementPeriod] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(null);
    setFileContent(null);
    setError(null);
    setResults(null);
    setBankStatementTransactions([]);
    setStatementPeriod(null);

    const acceptedTypes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!acceptedTypes.includes(selectedFile.type)) {
      setError('Formato de archivo no válido. Por favor, sube un archivo CSV o XLSX.');
      return;
    }
    
    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (e) => setFileContent(e.target?.result as ArrayBuffer);
    reader.readAsArrayBuffer(selectedFile);
  };

 const parseFile = (fileData: ArrayBuffer): Promise<BankTransaction[]> => {
    return new Promise((resolve, reject) => {
        try {
          const workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null });

           if (json.length < 1) {
            return reject(new Error("El archivo está vacío o no contiene datos legibles."));
          }
          
          const synonyms = {
              date: ['fecha', 'date', 'posted', 'trans date'],
              description: ['descrip', 'concept', 'details', 'transaction', 'memo', 'payee'],
              credit: ['abono', 'credit', 'crédito', 'deposit', 'income', 'payments received'],
              debit: ['cargo', 'debit', 'débito', 'withdrawal', 'expense', 'charges', 'payments'],
              amount: ['monto', 'amount', 'importe'],
              balance: ['balance', 'running balance', 'ending balance', 'daily balance', 'saldo']
          };

          let headerRowIndex = -1;
          let headerRow: any[] | null = null;
          for(let i=0; i<Math.min(json.length, 10); i++){
             if(Array.isArray(json[i]) && json[i].some(cell => typeof cell === 'string' && (synonyms.date.some(s => cell.toLowerCase().includes(s)) || synonyms.description.some(s => cell.toLowerCase().includes(s))))){
                headerRow = json[i];
                headerRowIndex = i;
                break;
             }
          }
          
          let columnIndex: Record<string, number> | null = {};
          
          if (headerRow) {
            headerRow.forEach((cell, index) => {
              if (typeof cell !== 'string') return;
              const lowerCell = cell.toLowerCase().trim();
              for (const key in synonyms) {
                  if(synonyms[key as keyof typeof synonyms].some(s => lowerCell.includes(s))) {
                      if (columnIndex![key] === undefined) columnIndex![key] = index;
                  }
              }
            });
          } else {
            columnIndex = inferColumns(json);
            if (!columnIndex) {
                columnIndex = fallbackParse(json);
                 if (!columnIndex) {
                    return reject(new Error("No se pudieron inferir las columnas automáticamente. Por favor, asegúrate que el archivo tiene un formato de fecha y monto claro."));
                }
            }
          }


          if (columnIndex.date === undefined || columnIndex.description === undefined) {
            return reject(new Error("No se pudieron mapear las columnas de Fecha y Descripción."));
          }
          if (columnIndex.credit === undefined && columnIndex.debit === undefined && columnIndex.amount === undefined) {
            return reject(new Error("Se requiere al menos una columna de Monto, Crédito/Abono o Débito/Cargo."));
          }
        
          const dataStartIndex = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
          const parsedData: BankTransaction[] = [];

          for(let i = dataStartIndex; i < json.length; i++) {
            const row = json[i];
            if(!Array.isArray(row) || row.length === 0 || row.every(cell => cell === null || cell === undefined || cell === "")) continue;
            
            const date = tryParseDate(row[columnIndex.date]);
            const description = String(row[columnIndex.description] || '').trim();

            if (!date || !description) continue;

            let amount: number | null = null;
            let bankType: 'deposit_credit' | 'withdrawal_debit' | null = null;
            
            const creditValue = columnIndex.credit !== undefined ? tryParseAmount(row[columnIndex.credit]) : null;
            const debitValue = columnIndex.debit !== undefined ? tryParseAmount(row[columnIndex.debit]) : null;
            const amountValue = columnIndex.amount !== undefined ? tryParseAmount(row[columnIndex.amount]) : null;

            if (debitValue !== null && debitValue !== 0) {
                amount = -Math.abs(debitValue);
                bankType = 'withdrawal_debit';
            } else if (creditValue !== null && creditValue > 0) {
                amount = creditValue;
                bankType = 'deposit_credit';
            } else if (amountValue !== null) {
                amount = amountValue;
                bankType = amountValue >= 0 ? 'deposit_credit' : 'withdrawal_debit';
            } else {
                 continue;
            }

            if (amount !== null && bankType !== null) {
              const lowerDesc = description.toLowerCase();
              let bankSubtype: BankTransaction['bankSubtype'] = 'unknown_debit';
              if (bankType === 'deposit_credit') {
                  bankSubtype = 'none';
              } else {
                  if (lowerDesc.includes('zelle to')) bankSubtype = 'zelle';
                  else if (lowerDesc.includes('online transfer to')) bankSubtype = 'online_transfer';
                  else if (lowerDesc.includes('atm withdrawal')) bankSubtype = 'atm_withdrawal';
                  else if (lowerDesc.includes('pmt') || lowerDesc.includes('payment') || lowerDesc.includes('mobile pmt')) bankSubtype = 'bill_payment_or_loan';
                  else if (lowerDesc.includes('fee')) bankSubtype = 'fee';
                  else if (lowerDesc.includes('purchase')) bankSubtype = 'purchase';
              }
              
              parsedData.push({ date, description, amount, bankType, bankSubtype });
            }
          }
          
          if(parsedData.length === 0){
             return reject(new Error("No se encontraron transacciones válidas en el archivo después del análisis."));
          }

          resolve(parsedData);

        } catch (err: any) {
          console.error("File parsing error:", err);
          reject(new Error("Error al procesar el archivo. Asegúrate que el formato sea correcto. " + err.message));
        }
    });
  };
  
  const reconcileData = (bankTxs: BankTransaction[], appTxs: Transaction[]): ReconciliationResult[] => {
    const results: ReconciliationResult[] = [];
    const matchedAppTxIds = new Set<string>();

    bankTxs.forEach(bankTx => {
      const bankDateStr = format(bankTx.date, 'yyyy-MM-dd');
      
      const perfectMatch = appTxs.find(appTx =>
        !matchedAppTxIds.has(appTx.id) &&
        format(new Date(appTx.date), 'yyyy-MM-dd') === bankDateStr &&
        Math.abs(appTx.amount - Math.abs(bankTx.amount)) < 0.01 &&
        ((bankTx.amount < 0 && appTx.direction === 'debit') || (bankTx.amount >= 0 && appTx.direction === 'credit'))
      );

      if (perfectMatch) {
        results.push({
          bankDate: bankDateStr, bankDesc: bankTx.description, bankAmount: bankTx.amount,
          appDate: format(new Date(perfectMatch.date), 'yyyy-MM-dd'), appCategory: perfectMatch.category, appAmount: perfectMatch.direction === 'debit' ? -perfectMatch.amount : perfectMatch.amount,
          status: 'conciliado',
        });
        matchedAppTxIds.add(perfectMatch.id);
      } else {
        const inconsistentMatch = appTxs.find(appTx =>
          !matchedAppTxIds.has(appTx.id) &&
          format(new Date(appTx.date), 'yyyy-MM-dd') === bankDateStr &&
          Math.abs(Math.abs(bankTx.amount) - appTx.amount) < 5
        );

        if (inconsistentMatch) {
          results.push({
            bankDate: bankDateStr, bankDesc: bankTx.description, bankAmount: bankTx.amount,
            appDate: format(new Date(inconsistentMatch.date), 'yyyy-MM-dd'), appCategory: inconsistentMatch.category, appAmount: inconsistentMatch.direction === 'debit' ? -inconsistentMatch.amount : inconsistentMatch.amount,
            status: 'inconsistente',
          });
          matchedAppTxIds.add(inconsistentMatch.id);
        } else {
          results.push({
            bankDate: bankDateStr, bankDesc: bankTx.description, bankAmount: bankTx.amount,
            appDate: null, appCategory: null, appAmount: null,
            status: 'faltante', importCategory: 'other',
          });
        }
      }
    });

    appTxs.forEach(appTx => {
      if (!matchedAppTxIds.has(appTx.id)) {
        results.push({
          bankDate: null, bankDesc: null, bankAmount: null,
          appDate: format(new Date(appTx.date), 'yyyy-MM-dd'), appCategory: appTx.category, appAmount: appTx.direction === 'debit' ? -appTx.amount : appTx.amount,
          status: 'sobrante',
        });
      }
    });

    return results.sort((a, b) => {
        const dateA = a.bankDate || a.appDate || '';
        const dateB = b.bankDate || b.appDate || '';
        return dateB.localeCompare(dateA);
    });
  };

  const handleStartReconciliation = async () => {
    if (!file || !user || !fileContent) {
      toast({ variant: 'destructive', title: 'Error', description: 'Falta el archivo o el usuario no está autenticado.' });
      return;
    }
    
    setIsProcessing(true);
    setResults(null);
    setError(null);
    setBankStatementTransactions([]);
    setAlerts([]);
    setStatementPeriod(null);

    try {
      setProgress(10);
      setProcessingStatus('Leyendo tu archivo (CSV/XLSX)...');
      const bankTransactions = await parseFile(fileContent);
      
      if (bankTransactions.length > 0) {
        const dates = bankTransactions.map(tx => tx.date);
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        setStatementPeriod(`Este archivo cubre del ${format(minDate, 'dd MMMM yyyy', {locale: es})} al ${format(maxDate, 'dd MMMM yyyy', {locale: es})}`);
      } else {
        toast({ title: 'Sin transacciones', description: 'No se encontraron transacciones legibles en el archivo.' });
        setIsProcessing(false);
        return;
      }

      setProgress(40);
      setProcessingStatus('Clasificando transacciones con IA...');
      
      let aiCategories: string[] = [];
      try {
        const transactionsToClassify = bankTransactions.map(bt => ({ description: bt.description, amount: bt.amount }));
        const categoryList = TRANSACTION_CATEGORIES.map(c => `- ${c.value} (${c.label}, tipo: ${c.type})`).join('\n');
        
        if (!categoryList) throw new Error("La lista de categorías está vacía.");
        
        const classificationResult = await classifyTransactionsAction({ transactions: transactionsToClassify, categoryList: categoryList });
        aiCategories = classificationResult.categories;
        
      } catch (aiError) {
        console.error("AI Classification failed:", aiError);
        toast({ variant: "default", title: "Fallo la clasificación por IA", description: "No se pudieron clasificar las categorías automáticamente. Se usará 'Otro' por defecto." });
        aiCategories = new Array(bankTransactions.length).fill('other');
      }

      setProgress(60);
      setProcessingStatus('Obteniendo tus registros...');
      const appTransactions = await getUserTransactions(user.uid);
      
      setProgress(80);
      setProcessingStatus('Comparando transacciones...');
      const reconciliationResults = reconcileData(bankTransactions, appTransactions);

      let bankTxIndex = 0;
      const finalResults = reconciliationResults.map(res => {
        if (res.status === 'faltante') {
          const category = aiCategories[bankTxIndex] || 'other';
          res.importCategory = category;
          bankTxIndex++;
        }
        return res;
      });
      
      const statementAsTransactions: Omit<Transaction, 'id' | 'importIds' | 'createdAt' | 'updatedAt'>[] = bankTransactions.map((bt, index) => {
          const result = finalResults.find(fr => fr.bankDesc === bt.description && fr.bankAmount === bt.amount && fr.bankDate === format(bt.date, 'yyyy-MM-dd'));
          let category = result?.importCategory || 'other';
          const direction = bt.amount < 0 ? 'debit' : 'credit';
          
          // Rule-based override for transfers
          const lowerDesc = bt.description.toLowerCase();
          if (lowerDesc.includes('online transfer') || lowerDesc.includes('zelle') || lowerDesc.includes('payment') || lowerDesc.includes('pago tdc')) {
              category = 'transfer';
          }
          
          const isTransfer = category === 'transfer';
          let type: 'income' | 'expense' | 'transfer' = isTransfer ? 'transfer' : (direction === 'credit' ? 'income' : 'expense');

          return {
              userId: user.uid, date: bt.date, amount: Math.abs(bt.amount), direction: direction, type: type, isTransfer: isTransfer,
              category: category, descriptionRaw: bt.description, source: 'bank_csv' as any, period: format(bt.date, 'yyyy-MM'),
              bankType: bt.bankType, bankSubtype: bt.bankSubtype,
          };
      });
      setBankStatementTransactions(statementAsTransactions as Transaction[]);
      
      setResults(finalResults);
      setProgress(100);
      setProcessingStatus('¡Análisis completo!');
      setTimeout(() => setIsProcessing(false), 1000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocurrió un error inesperado durante la conciliación.");
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleImportTransactions = async () => {
    if (!user || !results || !file || !fileContent) {
        toast({ variant: 'destructive', title: 'Error de Datos', description: 'Faltan datos de usuario o del archivo para guardar.' });
        return;
    }

    setIsSaving(true);
    
    const transactionsToImport = results.filter(r => r.status === 'faltante' && r.importCategory);

    if (transactionsToImport.length === 0) {
        toast({ title: 'Sin transacciones para importar', description: 'No hay movimientos nuevos marcados como "Faltante en App".' });
        setIsSaving(false);
        return;
    }

    try {
        const fileHash = await createFileHash(fileContent);
        const dates = transactionsToImport.map(tx => new Date(tx.bankDate!));
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        const periods = Array.from(new Set(dates.map(d => format(d, 'yyyy-MM'))));
        
        const importId = await saveImportedFile({
            fileName: file.name, fileSize: file.size, fileHash: fileHash, source: file.type.split('/')[1] as any,
            statementStartDate: minDate, statementEndDate: maxDate, periods: periods, totalExtracted: transactionsToImport.length,
            totalInserted: 0, totalDuplicates: 0, totalTransfersExcluded: 0, status: 'processing',
        });

        const transactionsWithHashes = await Promise.all(transactionsToImport.map(async r => {
            const date = new Date(r.bankDate!);
            const hashString = `${date.toISOString().split('T')[0]}|${r.bankAmount}|${r.bankDesc!}`;
            const hashId = await createTransactionHash(hashString);
            const category = r.importCategory!;
            const direction = r.bankAmount! < 0 ? 'debit' : 'credit';
            const isTransfer = category === 'transfer';
            let type: 'income' | 'expense' | 'transfer' = isTransfer ? 'transfer' : (direction === 'credit' ? 'income' : 'expense');
            
            const correspondingBankTx = bankStatementTransactions.find(btx => 
                btx.descriptionRaw === r.bankDesc! && (btx.direction === 'debit' ? -btx.amount : btx.amount) === r.bankAmount!
            );

            return {
                id: hashId,
                data: {
                    date: date, amount: Math.abs(r.bankAmount!), direction: direction, type: type, isTransfer: isTransfer, category: category,
                    descriptionRaw: r.bankDesc!, period: format(date, 'yyyy-MM'), source: file.type.split('/')[1] as any,
                    bankType: correspondingBankTx?.bankType, bankSubtype: correspondingBankTx?.bankSubtype,
                }
            };
        }));

        const result = await saveImportedTransactions(importId, transactionsWithHashes as any);

        if (result.success) {
            toast({ title: '¡Éxito!', description: `${result.savedCount} nuevas transacciones importadas. ${result.duplicatesIgnored} duplicados ignorados.` });
            refreshTransactions();
            handleStartReconciliation();
        } else {
            throw new Error(result.error || 'No se pudieron guardar las transacciones.');
        }

    } catch(err: any) {
         toast({ variant: 'destructive', title: 'Error de importación', description: `No se pudo guardar la importación. ${err.message}` });
    } finally {
        setIsSaving(false);
    }
  };

  const handleCategoryChange = (index: number, category: string) => {
    if (!results) return;
    const newResults = [...results];
    if(newResults[index]) {
        newResults[index].importCategory = category;
        setResults(newResults);
        setBankStatementTransactions(prev => 
            prev.map(tx => {
                if (tx.descriptionRaw === newResults[index].bankDesc && (tx.direction === 'debit' ? -tx.amount : tx.amount) === newResults[index].bankAmount!) {
                    const isTransfer = category === 'transfer';
                    let type: 'income' | 'expense' | 'transfer' = isTransfer ? 'transfer' : (tx.direction === 'credit' ? 'income' : 'expense');
                    return { ...tx, category: category, type: type, isTransfer: isTransfer };
                }
                return tx;
            })
        );
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'conciliado':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800/50"><CheckCircle className="h-3.5 w-3.5 mr-1.5" />Conciliado</Badge>;
      case 'faltante':
        return <Badge variant="destructive" className="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800/50"><AlertCircle className="h-3.5 w-3.5 mr-1.5" />Faltante en App</Badge>;
      case 'sobrante':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/50"><AlertCircle className="h-3.5 w-3.5 mr-1.5" />Sobrante en App</Badge>;
      case 'inconsistente':
        return <Badge variant="destructive"><XCircle className="h-3.5 w-3.5 mr-1.5" />Inconsistente</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const summary = results ? results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, { conciliado: 0, faltante: 0, sobrante: 0, inconsistente: 0}) : null;

  return (
    <div className="space-y-8">
      <Card className="shadow-lg border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl">Paso 1: Sube tu archivo de movimientos</CardTitle>
          <CardDescription>
            Exporta tus movimientos en formato CSV o XLSX. Nuestro sistema lo analizará y clasificará por ti.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative border-2 border-dashed border-muted-foreground/50 rounded-xl p-8 flex flex-col items-center justify-center space-y-4">
            <UploadCloud className="h-16 w-16 text-muted-foreground/50" />
            <p className="text-muted-foreground">Arrastra y suelta tu archivo aquí, o haz clic para buscar.</p>
            <input
              type="file"
              accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          {file && (
            <div className="text-left text-sm bg-muted/50 p-3 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">{file.name}</span>
                </div>
            </div>
          )}
           {statementPeriod && (
                <Alert variant="default" className="border-blue-200 dark:border-blue-800/50">
                    <Info className="h-4 w-4 text-blue-500"/>
                    <AlertTitle>Rango del Estado de Cuenta</AlertTitle>
                    <AlertDescription>{statementPeriod}</AlertDescription>
                </Alert>
            )}
          {error && (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error de archivo</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleStartReconciliation} disabled={!file || isProcessing || isSaving} size="lg" className="w-full max-w-xs mx-auto">
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isProcessing ? 'Analizando...' : 'Analizar Archivo'}
          </Button>
        </CardContent>
      </Card>
      
      {isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle>Analizando tus movimientos...</CardTitle>
            <CardDescription>Estamos comparando tu extracto con tus registros. Esto tomará un momento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="w-full" />
            <p className="text-center text-muted-foreground text-sm animate-pulse">{processingStatus}</p>
          </CardContent>
        </Card>
      )}

      {results && summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Paso 2: Revisa y Guarda</CardTitle>
            <CardDescription>Hemos comparado y clasificado los movimientos. Guarda las diferencias para construir tu historial.</CardDescription>
          </CardHeader>
          <CardContent>
            {results.length > 0 ? (
                <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">
                    <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
                        <p className="text-sm text-green-600 dark:text-green-400">Conciliado</p>
                        <p className="text-2xl font-bold text-green-800 dark:text-green-200">{summary.conciliado}</p>
                    </div>
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                        <p className="text-sm text-orange-600 dark:text-orange-400">Nuevos para Guardar</p>
                        <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">{summary.faltante}</p>
                    </div>
                     <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <p className="text-sm text-blue-600 dark:text-blue-400">Ya en tu App</p>
                        <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{summary.sobrante}</p>
                    </div>
                </div>

                {summary.faltante > 0 && user && (
                    <div className="flex flex-col sm:flex-row justify-end items-center gap-4 mb-4 p-4 border rounded-lg bg-muted/30">
                         <p className='text-sm text-muted-foreground flex-1'>Guarda las {summary.faltante} nuevas transacciones en tu historial para habilitar el análisis de tendencias y presupuestos.</p>
                        <Button onClick={handleImportTransactions} disabled={isSaving}>
                            <Save className="mr-2 h-4 w-4" />
                            {isSaving ? `Guardando...` : `Guardar en mi historial`}
                        </Button>
                    </div>
                )}
                
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead colSpan={3} className="bg-muted/30">Extracto Bancario</TableHead>
                            <TableHead colSpan={3} className="bg-muted/30">Finanzas Claras</TableHead>
                            <TableHead className="bg-muted/30 text-right">Estado</TableHead>
                        </TableRow>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead className="text-right"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {results.map((item, index) => (
                            <TableRow key={index} className={item.status === 'conciliado' ? '' : 'bg-muted/30'}>
                                <TableCell>{item.bankDate ? format(new Date(item.bankDate), 'dd/MM/yy') : '-'}</TableCell>
                                <TableCell className='max-w-[150px] truncate'>{item.bankDesc || '-'}</TableCell>
                                <TableCell className={`text-right font-mono ${item.bankAmount && item.bankAmount < 0 ? 'text_negative' : 'text-positive'}`}>{item.bankAmount ? formatCurrency(item.bankAmount) : '-'}</TableCell>
                                <TableCell>{item.appDate ? format(new Date(item.appDate), 'dd/MM/yy') : '-'}</TableCell>
                                <TableCell>
                                    {item.status === 'faltante' ? (
                                         <Select onValueChange={(value) => handleCategoryChange(index, value)} defaultValue={item.importCategory}>
                                            <SelectTrigger className="h-8 w-full min-w-[120px]">
                                                <SelectValue placeholder="Categorizar" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TRANSACTION_CATEGORIES.map(cat => (
                                                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                                    ))
                                                }
                                            </SelectContent>
                                        </Select>
                                    ) : (TRANSACTION_CATEGORIES.find(c => c.value === item.appCategory)?.label || item.appCategory || '-')}
                                </TableCell>
                                <TableCell className={`text-right font-mono ${item.appAmount && item.appAmount < 0 ? 'text_negative' : 'text-positive'}`}>{item.appAmount ? formatCurrency(item.appAmount) : '-'}</TableCell>
                                <TableCell className="text-right">{getStatusBadge(item.status)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </>
            ) : (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                    <FileWarning className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="font-medium">No se encontraron datos para conciliar.</p>
                    <p className="text-sm">No se encontraron transacciones en el archivo o en tu cuenta para el período analizado.</p>
                </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PdfAnalysisTab() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null); // base64 string
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeStatementPdfOutput | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(null);
    setFileContent(null);
    setError(null);
    setAnalysisResult(null);

    if (selectedFile.type !== 'application/pdf') {
      setError('Formato de archivo no válido. Por favor, sube un archivo PDF.');
      return;
    }
    
    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const result = e.target?.result as string;
        // The result includes the Base64 prefix, which we need to extract.
        const base64 = result.split(',')[1];
        setFileContent(base64);
    };
    reader.readAsDataURL(selectedFile);
  };
  
  const handleAnalyzePdf = async () => {
    if (!file || !fileContent) {
        toast({ variant: 'destructive', title: 'Error', description: 'Falta el archivo PDF.' });
        return;
    }
    setIsProcessing(true);
    setError(null);
    setAnalysisResult(null);

    try {
        const result = await analyzeStatementPdfAction({ fileContent });

        if (!result || !result.analysis || (result.totals.deposits === 0 && result.totals.withdrawals === 0)) {
             toast({
                variant: 'default',
                title: 'Análisis Completado con Observaciones',
                description: result?.analysis?.summary || 'No se pudo extraer un resumen numérico, revisa el PDF.'
            });
        } else {
            toast({
                title: 'Análisis de PDF Completo',
                description: 'Se ha generado un análisis detallado de tu estado de cuenta.'
            });
        }
        setAnalysisResult(result);

    } catch (e: any) {
        setError(`Ocurrió un error al analizar el PDF: ${e.message}`);
        toast({
            variant: 'destructive',
            title: 'Error de Análisis',
            description: e.message
        });
    } finally {
        setIsProcessing(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-lg border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl">Paso 1: Sube tu estado de cuenta</CardTitle>
          <CardDescription>
            Sube un estado de cuenta en formato PDF para que la IA lo analice y te dé una perspectiva financiera.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative border-2 border-dashed border-muted-foreground/50 rounded-xl p-8 flex flex-col items-center justify-center space-y-4">
            <UploadCloud className="h-16 w-16 text-muted-foreground/50" />
            <p className="text-muted-foreground">Arrastra y suelta tu archivo PDF aquí.</p>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          {file && (
            <div className="text-left text-sm bg-muted/50 p-3 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">{file.name}</span>
                </div>
            </div>
          )}
          {error && (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error de archivo</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleAnalyzePdf} disabled={!file || isProcessing} size="lg" className="w-full max-w-xs mx-auto">
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
            {isProcessing ? 'Analizando PDF...' : 'Analizar Estado de Cuenta'}
          </Button>
        </CardContent>
      </Card>
      
      {isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle>Analizando tu PDF con IA...</CardTitle>
            <CardDescription>Estamos leyendo y procesando tu estado de cuenta. Esto puede tardar hasta un minuto.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      )}

      {analysisResult && (
        <Card>
            <CardHeader>
                <CardTitle className="text-2xl">Paso 2: Revisa tu Análisis Financiero</CardTitle>
                <CardDescription>Este es el resumen y las recomendaciones que nuestro asesor de IA ha generado para ti.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                     <p><strong>Banco Detectado:</strong> {analysisResult.bankName || 'No detectado'}</p>
                     <p><strong>Período:</strong> {analysisResult.periodStart && analysisResult.periodEnd ? `${analysisResult.periodStart} - ${analysisResult.periodEnd}` : 'No detectado'}</p>
                </div>
                
                {analysisResult.analysis && (
                    <Card className="bg-muted/30 p-6">
                        <CardTitle className="text-lg mb-2">{analysisResult.analysis.headline}</CardTitle>
                        <p className="text-muted-foreground">{analysisResult.analysis.summary}</p>
                    </Card>
                )}

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Concepto</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell>Depósitos / Créditos Totales</TableCell>
                            <TableCell className="text-right font-mono text-positive">{formatCurrency(analysisResult.totals.deposits)}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>Retiros / Débitos Totales</TableCell>
                            <TableCell className="text-right font-mono text-negative">{formatCurrency(analysisResult.totals.withdrawals)}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>Comisiones (Fees)</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(analysisResult.totals.fees)}</TableCell>
                        </TableRow>
                        <TableRow className="font-bold bg-muted/20">
                            <TableCell>Saldo Neto del Período</TableCell>
                            <TableCell className={`text-right font-mono ${analysisResult.totals.net >= 0 ? 'text-positive' : 'text-negative'}`}>{formatCurrency(analysisResult.totals.net)}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
                
                {analysisResult.analysis && (
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="space-y-4">
                            <h3 className="font-semibold flex items-center gap-2"><Lightbulb className="h-5 w-5 text-primary"/> Insights Clave</h3>
                            {analysisResult.analysis.insights.length > 0 ? (
                                <ul className="space-y-2 list-disc list-inside text-muted-foreground">
                                    {analysisResult.analysis.insights.map((item, index) => (
                                        <li key={index}>{item}</li>
                                    ))}
                                </ul>
                            ) : (<p className='text-sm text-muted-foreground'>No se detectaron insights clave.</p>)}
                        </div>
                         <div className="space-y-4">
                            <h3 className="font-semibold flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-orange-500"/> Riesgos Detectados</h3>
                             {analysisResult.analysis.risks.length > 0 ? (
                                <ul className="space-y-2 list-disc list-inside text-muted-foreground">
                                    {analysisResult.analysis.risks.map((item, index) => (
                                        <li key={index}>{item}</li>
                                    ))}
                                </ul>
                            ) : (<p className='text-sm text-muted-foreground'>No se detectaron riesgos.</p>)}
                        </div>
                         <div className="space-y-4">
                            <h3 className="font-semibold flex items-center gap-2"><BarChart className="h-5 w-5 text-green-500"/> Recomendaciones</h3>
                             {analysisResult.analysis.recommendations.length > 0 ? (
                                <ul className="space-y-2 list-disc list-inside text-muted-foreground">
                                    {analysisResult.analysis.recommendations.map((item, index) => (
                                        <li key={index}>{item}</li>
                                    ))}
                                </ul>
                             ) : (<p className='text-sm text-muted-foreground'>No se generaron recomendaciones.</p>)}
                        </div>
                     </div>
                )}
            </CardContent>
        </Card>
      )}

    </div>
  )
}

function AuditTab() {
    const { bankStatementTransactions } = useReconciliation();

    const auditTotals = {
        income: bankStatementTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
        expense: bankStatementTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
        transfer: bankStatementTransactions.filter(t => t.type === 'transfer').reduce((sum, t) => sum + t.amount, 0),
        unknown: bankStatementTransactions.filter(t => !['income', 'expense', 'transfer'].includes(t.type)).reduce((sum, t) => sum + t.amount, 0),
    };

    const transferTransactions = bankStatementTransactions.filter(t => t.type === 'transfer');

    if (bankStatementTransactions.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Auditoría de Conciliación</CardTitle>
                    <CardDescription>Sube y analiza un archivo CSV/XLSX para ver el desglose de la auditoría aquí.</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                        <FileCheck2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <p className="font-medium text-lg">Esperando análisis...</p>
                        <p className="text-sm">Los resultados de la auditoría aparecerán aquí después de procesar un archivo.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Auditoría de Conciliación</CardTitle>
                <CardDescription>
                    Este es un desglose de cómo se han clasificado y sumado las transacciones del archivo importado.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div>
                    <h3 className="text-lg font-semibold mb-4">Totales por Tipo de Transacción</h3>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tipo de Transacción</TableHead>
                                <TableHead className="text-right">Monto Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="font-medium">Ingresos (Income)</TableCell>
                                <TableCell className="text-right font-mono text-positive">{formatCurrency(auditTotals.income)}</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="font-medium">Gastos (Expense)</TableCell>
                                <TableCell className="text-right font-mono text-negative">{formatCurrency(auditTotals.expense)}</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="font-medium">Transferencias (Transfer)</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(auditTotals.transfer)}</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="font-medium">Desconocido/Otro</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(auditTotals.unknown)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
                 <div>
                    <h3 className="text-lg font-semibold mb-4">Desglose de Transferencias Identificadas</h3>
                    {transferTransactions.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transferTransactions.map((tx, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{format(tx.date, 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>{tx.descriptionRaw}</TableCell>
                                        <TableCell className={`text-right font-mono ${tx.direction === 'credit' ? 'text-positive' : ''}`}>{formatCurrency(tx.direction === 'credit' ? tx.amount : -tx.amount)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No se clasificó ninguna transacción como transferencia.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}


export default function ReconciliationPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Importar y Analizar</h1>
        <p className="text-lg text-muted-foreground mt-1">
          Usa estas herramientas para cargar y entender tus datos financieros.
        </p>
      </div>

      <Tabs defaultValue="csv" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="csv">Importar Movimientos (CSV/XLSX)</TabsTrigger>
          <TabsTrigger value="pdf">Analizar Estado de Cuenta (PDF)</TabsTrigger>
          <TabsTrigger value="audit">Auditoría de Conciliación</TabsTrigger>
        </TabsList>
        <TabsContent value="csv" className="mt-6">
          <CsvImportTab />
        </TabsContent>
        <TabsContent value="pdf" className="mt-6">
          <PdfAnalysisTab />
        </TabsContent>
        <TabsContent value="audit" className="mt-6">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

    

      
