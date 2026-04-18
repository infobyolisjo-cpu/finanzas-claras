'use client';

import { useState, useEffect } from 'react';
import { checkExpenseExceedsIncomeAction } from '@/app/actions';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertTriangle } from 'lucide-react';

type ExpenseAlertProps = {
  income: number;
  expenses: number;
};

export function ExpenseAlert({ income, expenses }: ExpenseAlertProps) {
  const [alertMessage, setAlertMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkExpenses() {
      // La alerta se dispara si los GASTOS REALES (tipo 'expense') superan los INGRESOS REALES (tipo 'income')
      if (expenses > 0 && income > 0 && expenses > income) {
        setLoading(true);
        try {
          const result = await checkExpenseExceedsIncomeAction({ income, expenses });
          setAlertMessage(result.alertMessage);
        } catch (error) {
          console.error("AI alert generation failed:", error);
          setAlertMessage("Alerta: ¡Tus gastos han superado tus ingresos este mes!");
        } finally {
            setLoading(false);
        }
      } else {
        setAlertMessage('');
      }
    }
    checkExpenses();
  }, [income, expenses]);

  if (loading || !alertMessage) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>¡Atención!</AlertTitle>
      <AlertDescription>{alertMessage}</AlertDescription>
    </Alert>
  );
}

    