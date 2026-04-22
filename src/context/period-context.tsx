
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

const validateAndCorrectYear = (date: Date): Date => {
  if (!isValid(date)) return date;
  const year = getYear(date);
  if (year < 1900 || year > 2100) return setYear(date, new Date().getFullYear());
  return date;
};

const CURRENT_MONTH = format(new Date(), 'yyyy-MM');

export const PeriodProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  // Start with empty so the auto-select effect always runs once data arrives
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  const refreshTransactions = useCallback(async () => {
    if (user) {
      setLoading(true);
      try {
        const data = await getUserTransactions(user.uid);
        const normalized = data.map(tx => {
          const correctedDate = validateAndCorrectYear(new Date(tx.date));
          return { ...tx, date: correctedDate, period: format(correctedDate, 'yyyy-MM') };
        });
        setAllTransactions(normalized);
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

  useEffect(() => { refreshTransactions(); }, [refreshTransactions]);

  // Periods with actual transaction data, sorted descending
  const periodsWithData = useMemo(() => {
    const s = new Set(allTransactions.map(t => t.period));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [allTransactions]);

  // Selector options: periods with data + current month (for budget creation)
  const periodOptions = useMemo(() => {
    const s = new Set(periodsWithData);
    s.add(CURRENT_MONTH);
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [periodsWithData]);

  // Auto-select: always prefer the most recent period that has transactions.
  // Falls back to current month only when there are no transactions at all.
  useEffect(() => {
    if (loading) return;
    const best = periodsWithData.length > 0 ? periodsWithData[0] : CURRENT_MONTH;
    const currentHasData = allTransactions.some(t => t.period === selectedPeriod);

    if (!selectedPeriod || !currentHasData) {
      setSelectedPeriod(best);
    }
  }, [allTransactions, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentPeriodTransactions = useMemo(() => {
    if (!selectedPeriod) return [];
    return allTransactions.filter(t => t.period === selectedPeriod);
  }, [allTransactions, selectedPeriod]);

  return (
    <PeriodContext.Provider value={{
      selectedPeriod,
      setSelectedPeriod,
      periodOptions,
      currentPeriodTransactions,
      allTransactions,
      loading,
      refreshTransactions,
    }}>
      {children}
    </PeriodContext.Provider>
  );
};

export const usePeriod = () => {
  const context = useContext(PeriodContext);
  if (context === undefined) throw new Error('usePeriod must be used within a PeriodProvider');
  return context;
};
