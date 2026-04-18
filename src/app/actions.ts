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

// ===== AI actions temporarily disabled =====

export async function checkExpenseExceedsIncomeAction(
  _input: any
): Promise<{ exceeds: boolean; message?: string }> {
  return {
    exceeds: false,
    message: 'AI temporalmente desactivada.',
  };
}

export async function classifyTransactionsAction(
  input: { transactions: any[] }
): Promise<{ categories: string[] }> {
  return {
    categories: input.transactions.map(() => 'other'),
  };
}

export async function detectRecurringExpensesAction(
  _input: any
): Promise<{ recurringExpenses: any[] }> {
  return {
    recurringExpenses: [],
  };
}

export async function extractTransactionsFromPdfAction(
  _input: any
): Promise<{ transactions: any[]; error?: string }> {
  return {
    transactions: [],
    error: 'Extracción PDF temporalmente desactivada.',
  };
}

export async function generateFinancialInsightsAction(
  _input: any
): Promise<{ insights: string[]; summary?: string }> {
  return {
    insights: [],
    summary: 'Insights temporales desactivados.',
  };
}

export async function getStarRecommendationAction(
  _input: any
): Promise<{ recommendation: string; score?: number }> {
  return {
    recommendation: 'Recomendación temporalmente no disponible.',
    score: 0,
  };
}

export async function analyzeStatementPdfAction(
  _input: any
): Promise<{ success: boolean; data?: any; error?: string }> {
  return {
    success: false,
    error: 'Análisis PDF temporalmente desactivado.',
  };
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
