'use server';

import { headers } from 'next/headers';
import { initializeAdminApp } from '@/firebase/admin';
import {
  cleanupDuplicateTransactions,
  deleteImportAndTransactions,
  saveImportedFile,
  saveImportedTransactions,
  updateTransactionCategory,
} from '@/lib/firestore';
import type { Transaction, Import } from '@/lib/types';

async function getUserId(): Promise<string | null> {
  const headersList = headers();
  const authHeader = headersList.get('Authorization');

  if (!authHeader) {
    console.warn('[Server Action] No Authorization header found.');
    return null;
  }

  const idToken = authHeader.split('Bearer ')[1];

  if (!idToken) {
    console.warn('[Server Action] No ID token found in Authorization header.');
    return null;
  }

  try {
    const { auth } = initializeAdminApp();
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error: any) {
    console.error('[Server Action] Error verifying ID token:', error.message);
    return null;
  }
}

// ===== Helpers =====

async function callGemini(prompt: string, pdfBase64?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada.');

  const parts: any[] = [];
  if (pdfBase64) {
    parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfBase64 } });
  }
  parts.push({ text: prompt });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ===== AI actions =====

export async function checkExpenseExceedsIncomeAction(
  _input: any
): Promise<{ exceeds: boolean; message?: string }> {
  return { exceeds: false };
}

export async function classifyTransactionsAction(
  input: { transactions: { description: string; amount: number }[]; categoryList: string }
): Promise<{ categories: string[] }> {
  if (!input.transactions.length) return { categories: [] };

  const list = input.transactions
    .map((t, i) => `${i + 1}. "${t.description}" | ${t.amount > 0 ? '+' : ''}${t.amount}`)
    .join('\n');

  const prompt = `Clasifica cada transacción bancaria en una de estas categorías exactas: ${input.categoryList}

Transacciones:
${list}

Devuelve SOLO un array JSON con los valores de categoría en el mismo orden, sin explicaciones. Ejemplo: ["food","salary","transport"]`;

  try {
    const raw = await callGemini(prompt);
    const match = raw.match(/\[[\s\S]*?\]/);
    if (match) {
      const arr = JSON.parse(match[0]);
      if (Array.isArray(arr) && arr.length === input.transactions.length) {
        return { categories: arr };
      }
    }
  } catch {}

  return { categories: input.transactions.map(() => 'other') };
}

export async function detectRecurringExpensesAction(
  _input: any
): Promise<{ recurringExpenses: any[] }> {
  return { recurringExpenses: [] };
}

export async function extractTransactionsFromPdfAction(
  _input: any
): Promise<{ transactions: any[]; error?: string }> {
  return { transactions: [], error: 'Usa analyzeStatementPdfAction en su lugar.' };
}

export async function generateFinancialInsightsAction(
  _input: any
): Promise<{ insights: string[]; summary?: string }> {
  return { insights: [], summary: '' };
}

export async function getStarRecommendationAction(
  _input: any
): Promise<{ recommendation: string; score?: number }> {
  return { recommendation: '', score: 0 };
}

export async function analyzeStatementPdfAction(
  input: { fileContent: string }
): Promise<any> {
  try {
    const prompt = `Eres un asistente financiero experto. Analiza este estado de cuenta bancario y extrae la siguiente información en formato JSON estricto.

Responde ÚNICAMENTE con el JSON, sin markdown, sin texto adicional:
{
  "bankName": "nombre del banco o null",
  "periodStart": "YYYY-MM-DD o null",
  "periodEnd": "YYYY-MM-DD o null",
  "totals": {
    "deposits": número total de depósitos/abonos,
    "withdrawals": número total de retiros/cargos (positivo),
    "fees": número total de comisiones (positivo),
    "net": saldo neto (deposits - withdrawals - fees)
  },
  "analysis": {
    "headline": "título corto del análisis en español",
    "summary": "resumen ejecutivo de 2-3 oraciones en español",
    "insights": ["insight 1", "insight 2", "insight 3"],
    "risks": ["riesgo 1", "riesgo 2"],
    "recommendations": ["recomendación 1", "recomendación 2", "recomendación 3"]
  }
}`;

    const raw = await callGemini(prompt, input.fileContent);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No se pudo extraer JSON de la respuesta.');

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (e: any) {
    return {
      bankName: null,
      periodStart: null,
      periodEnd: null,
      totals: { deposits: 0, withdrawals: 0, fees: 0, net: 0 },
      analysis: {
        headline: 'Error al analizar el PDF',
        summary: e.message ?? 'No se pudo procesar el archivo.',
        insights: [],
        risks: [],
        recommendations: [],
      },
    };
  }
}

// ===== Firestore actions =====

export async function cleanupDuplicateTransactionsAction(): Promise<{
  success: boolean;
  error?: string;
  totalChecked: number;
  duplicatesFound: number;
  duplicatesDeleted: number;
}> {
  const userId = await getUserId();
  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      totalChecked: 0,
      duplicatesFound: 0,
      duplicatesDeleted: 0,
    };
  }
  return await cleanupDuplicateTransactions(userId);
}

export async function deleteImportAndTransactionsAction(
  importId: string
): Promise<{ success: boolean; error?: string; deletedCount: number }> {
  const userId = await getUserId();
  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      deletedCount: 0,
    };
  }
  return await deleteImportAndTransactions(userId, importId);
}

export async function saveImportedFileAction(
  fileInfo: Omit<Import, 'id' | 'userId' | 'createdAt' | 'isActive'>
): Promise<{ success: boolean; error?: string; importId?: string }> {
  const userId = await getUserId();
  if (!userId) {
    return { success: false, error: 'Authentication required.' };
  }
  const importId = await saveImportedFile(userId, fileInfo);
  return { success: true, importId };
}

export async function saveImportedTransactionsAction(
  importId: string,
  transactionsToImport: {
    id: string;
    data: Omit<
      Transaction,
      'id' | 'userId' | 'importIds' | 'createdAt' | 'updatedAt'
    >;
  }[]
): Promise<{
  success: boolean;
  error?: string;
  savedCount: number;
  duplicatesIgnored: number;
}> {
  const userId = await getUserId();
  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      savedCount: 0,
      duplicatesIgnored: 0,
    };
  }
  return await saveImportedTransactions(userId, importId, transactionsToImport);
}

export async function saveCategorizationChangeAction(
  txId: string,
  newCategory: string
): Promise<{ success: boolean; error?: string }> {
  const userId = await getUserId();
  if (!userId) {
    return { success: false, error: 'Authentication required.' };
  }
  return await updateTransactionCategory(userId, txId, newCategory);
}
