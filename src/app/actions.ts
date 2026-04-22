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

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Text-only Gemini call with exponential backoff across models and retries.
async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada.');

  const parts = [{ text: prompt }];
  const MAX_ROUNDS = 3;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (round > 0) await sleep(1000 * Math.pow(2, round - 1) + Math.random() * 400);

    for (const model of GEMINI_MODELS) {
      const res = await fetch(
        `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }] }),
        }
      );

      if (res.status === 503 || res.status === 429) continue;

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini error (${model}): ${err}`);
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }
  }

  throw new Error('El servicio de IA no está disponible en este momento. Intenta de nuevo en unos minutos.');
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

// Legacy stub — kept so existing imports don't break at compile time.
export async function analyzeStatementPdfAction(_input: any): Promise<any> {
  return null;
}

export type AiInsights = {
  headline: string;
  summary: string;
  insights: string[];
  risks: string[];
  recommendations: string[];
};

// Layer 2: receives a small structured summary extracted client-side (no PDF).
// Returns null gracefully when Gemini is unavailable.
export async function getAiInsightsAction(input: {
  bankName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  totals: { deposits: number; withdrawals: number; fees: number; net: number };
  transactionCount: number;
  topDescriptions: string[];
}): Promise<AiInsights | null> {
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

  const savingsRate =
    input.totals.deposits > 0
      ? ((input.totals.net / input.totals.deposits) * 100).toFixed(1)
      : '0';

  const prompt = `Eres una asesora financiera personal experta. Analiza este resumen financiero y genera insights en español.

Datos del estado de cuenta:
- Banco: ${input.bankName ?? 'No identificado'}
- Período: ${input.periodStart && input.periodEnd ? `${input.periodStart} al ${input.periodEnd}` : 'No identificado'}
- Depósitos totales: ${fmt(input.totals.deposits)}
- Retiros totales: ${fmt(input.totals.withdrawals)}
- Comisiones: ${fmt(input.totals.fees)}
- Saldo neto: ${fmt(input.totals.net)}
- Tasa de ahorro: ${savingsRate}%
- Número de movimientos: ${input.transactionCount}
- Principales conceptos: ${input.topDescriptions.slice(0, 6).join(', ') || 'No identificados'}

Responde ÚNICAMENTE con JSON válido (sin markdown):
{
  "headline": "título corto y claro (máx 10 palabras)",
  "summary": "resumen ejecutivo en 2-3 oraciones concretas",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "risks": ["riesgo 1", "riesgo 2"],
  "recommendations": ["recomendación 1", "recomendación 2", "recomendación 3"]
}`;

  try {
    const raw = await callGemini(prompt);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return parsed as AiInsights;
  } catch {
    return null;
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
