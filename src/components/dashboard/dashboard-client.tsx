'use client';

import { useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { usePeriod } from '@/context/period-context';
import type { Transaction } from '@/lib/types';

import { SummaryCards } from './summary-cards';
import { TransactionsTable } from './transactions-table';
import { ExpenseAlert } from './expense-alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { AddTransactionDialog } from './add-transaction-dialog';
import { Skeleton } from '../ui/skeleton';
import { BalanceChart } from '../analysis/balance-chart';
import { CategoryDonutChart } from '../analysis/category-donut-chart';
import { WeeklySummaryChart } from '../analysis/weekly-summary-chart';
import { NoDataPlaceholder } from '../analysis/no-data-placeholder';
import { getDaysInMonth } from 'date-fns';


export function DashboardClient() {
  const { user } = useAuth();
  const { selectedPeriod, currentPeriodTransactions, loading, refreshTransactions } = usePeriod();

  const { monthlyIncome, totalDebits, realExpenses, moneyMovements, avgDailySpending } = useMemo(() => {
    // Ingresos: Solo transacciones TIPO 'income'.
    const income = currentPeriodTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    // Egresos del banco (débitos): Todas las transacciones con dirección 'debit', incluyendo transferencias de salida.
    const debits = currentPeriodTransactions
      .filter(t => t.direction === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Gasto Real (Consumo): Solo transacciones TIPO 'expense'. Excluye transferencias.
    const expenses = currentPeriodTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    // Movimientos de dinero: Solo transacciones TIPO 'transfer'.
    const movements = currentPeriodTransactions
      .filter(t => t.type === 'transfer')
      .reduce((sum, t) => sum + t.amount, 0);

    const daysInPeriod = getDaysInMonth(new Date(selectedPeriod + '-02'));
    const dailySpending = expenses / daysInPeriod;

    return {
      monthlyIncome: income,
      totalDebits: debits,
      realExpenses: expenses,
      moneyMovements: movements,
      avgDailySpending: dailySpending
    };
  }, [currentPeriodTransactions, selectedPeriod]);

  const hasTransactionsThisMonth = currentPeriodTransactions.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
            <h1 className="text-3xl font-bold font-headline">Dashboard</h1>
            <p className="text-muted-foreground">Un resumen de tus finanzas para el período seleccionado.</p>
        </div>
        <AddTransactionDialog onTransactionAdded={refreshTransactions} />
      </div>

      <ExpenseAlert income={monthlyIncome} expenses={realExpenses} />
      
      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
        <SummaryCards 
            income={monthlyIncome} 
            expenses={totalDebits} // This will be "Egresos del banco"
            realConsumption={realExpenses} // This will be "Gasto real"
            avgDailySpending={avgDailySpending}
        />
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Evolución del Saldo</CardTitle>
              <CardDescription>Evolución diaria de tu saldo durante el mes seleccionado.</CardDescription>
            </CardHeader>
            <CardContent>
              {hasTransactionsThisMonth ? <BalanceChart transactions={currentPeriodTransactions} /> : <NoDataPlaceholder />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Gastos por Categoría</CardTitle>
              <CardDescription>Distribución de tus gastos del mes seleccionado.</CardDescription>
            </CardHeader>
            <CardContent>
              {hasTransactionsThisMonth ? <CategoryDonutChart transactions={currentPeriodTransactions} /> : <NoDataPlaceholder />}
            </CardContent>
          </Card>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Resumen Semanal</CardTitle>
                <CardDescription>Comparación de tus ingresos y gastos de las semanas del mes seleccionado.</CardDescription>
            </CardHeader>
            <CardContent>
                {hasTransactionsThisMonth ? <WeeklySummaryChart transactions={currentPeriodTransactions} /> : <NoDataPlaceholder />}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
            <CardTitle>Transacciones Recientes del Mes</CardTitle>
            <CardDescription>Estos son los últimos movimientos que has registrado en el mes seleccionado.</CardDescription>
            </CardHeader>
            <CardContent>
              {hasTransactionsThisMonth ? 
                <TransactionsTable transactions={currentPeriodTransactions.slice(0, 5)} /> :
                <div className="text-center text-muted-foreground py-12">
                  <p className="font-medium">No hay transacciones este mes.</p>
                  <p className="text-sm">¡Añade una para empezar!</p>
                </div>
              }
            </CardContent>
        </Card>
        </>
      )}
    </div>
  );
}

const DashboardSkeleton = () => (
    <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="lg:col-span-2 h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
        <Card>
            <CardHeader>
                <Skeleton className="h-7 w-52 rounded-md" />
                <Skeleton className="h-5 w-72 rounded-md" />
            </CardHeader>
            <CardContent className="space-y-2">
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
            </CardContent>
        </Card>
    </div>
)
