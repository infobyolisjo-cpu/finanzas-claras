
'use client';

import React, { createContext, useState, useContext, useEffect, useMemo, type ReactNode, useCallback } from 'react';
import { useAuth } from './auth-context';
import { getUserTransactions } from '@/lib/firestore';
import type { Transaction } from '@/lib/types';
import { format, getYear, setYear, isValid } from 'date-fns';

interface PeriodContextType {
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  periodOptions: string[];
  currentPeriodTransactions: Transaction[];
  allTransactions: Transaction[];
  loading: boolean;
  refreshTransactions: () => void;
}

const PeriodContext = createContext<PeriodContextType | undefined>(undefined);

// Helper function to validate and correct the year of a date
const validateAndCorrectYear = (date: Date): Date => {
  if (!isValid(date)) return date;
  const year = getYear(date);
  if (year < 1900 || year > 2100) {
    return setYear(date, new Date().getFullYear());
  }
  return date;
}

export const PeriodProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(format(new Date(), 'yyyy-MM'));

  const refreshTransactions = useCallback(async () => {
    if (user) {
      setLoading(true);
      try {
        const data = await getUserTransactions(user.uid);
        
        // Normalize all transactions to ensure correct period format
        const transactionsWithNormalizedPeriod = data.map(tx => {
            const correctedDate = validateAndCorrectYear(new Date(tx.date));
            return {
                ...tx,
                date: correctedDate, // Update the date object itself
                period: format(correctedDate, 'yyyy-MM') // Recalculate period based on corrected date
            };
        });

        setAllTransactions(transactionsWithNormalizedPeriod);

      } catch (err) {
        console.error(err);
        setAllTransactions([]);
      } finally {
        setLoading(false);
      }
    } else {
        setAllTransactions([]);
        setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshTransactions();
  }, [refreshTransactions]);

  const periodOptions = useMemo(() => {
    // The Set will automatically handle duplicates, ensuring each 'YYYY-MM' is unique
    const options = new Set(allTransactions.map(t => t.period));
    const currentMonthOption = format(new Date(), 'yyyy-MM');
    if (!options.has(currentMonthOption)) {
        options.add(currentMonthOption);
    }
    return Array.from(options).sort((a, b) => b.localeCompare(a));
  }, [allTransactions]);

  const currentPeriodTransactions = useMemo(() => {
    if (!selectedPeriod) return [];
    // The filter now works reliably because all `tx.period` have been normalized
    return allTransactions.filter(t => t.period === selectedPeriod);
  }, [allTransactions, selectedPeriod]);

  useEffect(() => {
    if (periodOptions.length > 0 && !periodOptions.includes(selectedPeriod)) {
      setSelectedPeriod(periodOptions[0]);
    }
  }, [periodOptions, selectedPeriod]);

  return (
    <PeriodContext.Provider value={{ 
        selectedPeriod, 
        setSelectedPeriod,
        periodOptions,
        currentPeriodTransactions,
        allTransactions,
        loading,
        refreshTransactions
    }}>
      {children}
    </PeriodContext.Provider>
  );
};

export const usePeriod = () => {
  const context = useContext(PeriodContext);
  if (context === undefined) {
    throw new Error('usePeriod must be used within a PeriodProvider');
  }
  return context;
};
