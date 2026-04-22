import type { Timestamp } from 'firebase/firestore';

export type Transaction = {
  id: string; // Fingerprint hash
  userId: string;
  importIds: string[]; // List of import IDs this transaction appeared in
  date: Date;
  period: string; // YYYY-MM
  descriptionRaw: string;
  descriptionNormalized?: string;
  amount: number; // Always positive
  direction: 'debit' | 'credit';
  type: 'income' | 'expense' | 'transfer';
  isTransfer: boolean;
  category?: string;
  merchant?: string;
  source: 'pdf' | 'csv' | 'xlsx' | 'manual';
  createdAt: Date;
  updatedAt: Date;
  // New fields for bank-based classification
  bankType: 'deposit_credit' | 'withdrawal_debit';
  bankSubtype: 'purchase' | 'online_transfer' | 'zelle' | 'atm_withdrawal' | 'bill_payment_or_loan' | 'fee' | 'unknown_debit' | 'none';
};

export type TransactionFirestore = Omit<Transaction, 'id' | 'date' | 'createdAt' | 'updatedAt'> & {
  date: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Budget = {
  id?: string;
  userId: string;
  category: string;
  amount: number;
  period: string; // YYYY-MM
};

export type BudgetFirestore = Omit<Budget, 'id'> & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Import = {
    id: string;
    userId: string;
    createdAt: Date;
    source: 'pdf' | 'csv' | 'xlsx';
    fileName: string;
    fileSize: number;
    fileHash: string; // sha256 of file content
    statementStartDate?: Date;
    statementEndDate?: Date;
    periods: string[]; // YYYY-MM formats
    totalExtracted: number;
    totalInserted: number;
    totalDuplicates: number;
    totalTransfersExcluded: number;
    status: 'processing' | 'completed' | 'failed';
    errorMessage?: string;
    isActive: boolean; // For soft deletes
};

export type ImportFirestore = Omit<Import, 'id' | 'createdAt' | 'statementStartDate' | 'statementEndDate'> & {
  createdAt: Timestamp;
  statementStartDate?: Timestamp;
  statementEndDate?: Timestamp;
};

export type BusinessType = 'productos' | 'servicios' | 'mixto';

export type UserProfile = {
  userId: string;
  businessType: BusinessType;
  hasEmployees: boolean;
  selectedAt: Date;
};
