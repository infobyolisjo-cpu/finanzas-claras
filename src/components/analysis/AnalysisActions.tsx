'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import type { AnalysisResult } from './analysis-client';
import type { Transaction } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { useState } from 'react';

interface AnalysisActionsProps {
  analysisResult: AnalysisResult;
}

export function AnalysisActions({ analysisResult }: AnalysisActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleDownload = async (formatType: 'csv' | 'xlsx' | 'pdf') => {
    if (!analysisResult || loading) return;
    setLoading(formatType);

    const { periodTransactions, ...summary } = analysisResult;
    const fileName = `Analisis_Financiero_${format(new Date(), 'yyyy-MM-dd')}`;

    try {
        switch (formatType) {
        case 'csv':
            await downloadCSV(periodTransactions, `${fileName}.csv`);
            break;
        case 'xlsx':
            await downloadXLSX(periodTransactions, summary, `${fileName}.xlsx`);
            break;
        case 'pdf':
            await downloadPDF(summary, `${fileName}.pdf`);
            break;
        }
    } catch(e) {
        console.error("Download failed:", e);
    } finally {
        setLoading(null);
    }
  };

  const downloadCSV = async (data: Transaction[], fileName: string) => {
    const headers = ['Fecha', 'Descripcion', 'Categoria', 'Monto'];
    const rows = data.map(tx =>
      [
        format(new Date(tx.date), 'yyyy-MM-dd'),
        tx.note || '',
        tx.category,
        tx.type === 'expense' ? -tx.amount : tx.amount,
      ].join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadXLSX = async (
    transactions: Transaction[],
    summary: Omit<AnalysisResult, 'periodTransactions'>,
    fileName: string
  ) => {
    const XLSX = await import('xlsx');
    const summary_ws_data = [
      ['Resumen Financiero'],
      [],
      ['Ingresos Totales', summary.totalIncome],
      ['Gastos Totales', summary.totalExpenses],
      ['Saldo Neto', summary.netBalance],
      ['# Transacciones', summary.transactionCount],
      ['Gasto Promedio/Día', summary.avgDailySpending],
    ];
    if (summary.initialBalance !== undefined) {
      summary_ws_data.push(['Saldo Inicial (Opcional)', summary.initialBalance]);
      summary_ws_data.push(['Saldo Final Estimado', summary.finalEstimatedBalance!]);
    }
    const summary_ws = XLSX.utils.aoa_to_sheet(summary_ws_data);
    XLSX.utils.sheet_set_num_fmt(summary_ws, 'B3:B9', '"$"#,##0.00');

    const transactions_ws_data = [
      ['Fecha', 'Descripcion', 'Categoria', 'Monto'],
      ...transactions.map(tx => [
        format(new Date(tx.date), 'yyyy-MM-dd'),
        tx.note || '',
        tx.category,
        tx.type === 'expense' ? -tx.amount : tx.amount,
      ]),
    ];
    const transactions_ws = XLSX.utils.aoa_to_sheet(transactions_ws_data);
    XLSX.utils.sheet_set_num_fmt(transactions_ws, 'D2:D' + (transactions.length + 1), '"$"#,##0.00');

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, summary_ws, 'Resumen');
    XLSX.utils.book_append_sheet(wb, transactions_ws, 'Transacciones');

    XLSX.writeFile(wb, fileName);
  };

  const downloadPDF = async (summary: Omit<AnalysisResult, 'periodTransactions'>, fileName: string) => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Análisis Financiero', 14, 22);

    const summaryBody = [
      ['Ingresos Totales', formatCurrency(summary.totalIncome)],
      ['Gastos Totales', formatCurrency(summary.totalExpenses)],
      ['Saldo Neto del Período', formatCurrency(summary.netBalance)],
      ['# Transacciones', summary.transactionCount.toString()],
      ['Gasto Promedio/Día', formatCurrency(summary.avgDailySpending)],
    ];

    if (summary.initialBalance !== undefined) {
      summaryBody.push(['Saldo Inicial', formatCurrency(summary.initialBalance)]);
      summaryBody.push(['Saldo Final Estimado', formatCurrency(summary.finalEstimatedBalance!)]);
    }

    autoTable(doc, {
      startY: 30,
      head: [['Resumen Numérico', '']],
      body: summaryBody,
    });

    if (summary.insights.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Insights Accionables']],
        body: summary.insights.map(i => [
          `Hallazgo: ${i.finding}\nImportancia: ${i.importance}\nSugerencia: ${i.suggestedAction}`,
        ]),
        styles: { cellPadding: 3 },
      });
    }

    doc.save(fileName);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={!!loading}>
          {loading ? (
             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Descargar Resultados
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => handleDownload('csv')}>
            {loading === 'csv' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Como CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleDownload('xlsx')}>
            {loading === 'xlsx' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Como Excel (XLSX)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleDownload('pdf')}>
            {loading === 'pdf' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Como PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
