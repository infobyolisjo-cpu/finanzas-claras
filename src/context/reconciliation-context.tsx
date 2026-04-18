'use client';

import React, { createContext, useState, useContext, type ReactNode } from 'react';
import type { Transaction } from '@/lib/types';

export type Alert = {
  id: string;
  title: string;
  description: string;
  severity: 'warning' | 'info' | 'error';
  date: string;
};

interface ReconciliationContextType {
  bankStatementTransactions: Transaction[];
  setBankStatementTransactions: (transactions: Transaction[]) => void;
  alerts: Alert[];
  setAlerts: (alerts: Alert[]) => void;
}

const ReconciliationContext = createContext<ReconciliationContextType | undefined>(undefined);

export const ReconciliationProvider = ({ children }: { children: ReactNode }) => {
  const [bankStatementTransactions, setBankStatementTransactions] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  return (
    <ReconciliationContext.Provider value={{ 
        bankStatementTransactions, 
        setBankStatementTransactions,
        alerts,
        setAlerts 
    }}>
      {children}
    </ReconciliationContext.Provider>
  );
};

export const useReconciliation = () => {
  const context = useContext(ReconciliationContext);
  if (context === undefined) {
    throw new Error('useReconciliation must be used within a ReconciliationProvider');
  }
  return context;
};
