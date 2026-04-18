
'use client';

import { useMemo } from 'react';
import { AddTransactionDialog } from '@/components/dashboard/add-transaction-dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import { usePeriod } from '@/context/period-context';
import type { Transaction } from '@/lib/types';
import { TransactionsTable } from '@/components/dashboard/transactions-table';

export default function TransactionsPage() {
  const { allTransactions, loading, refreshTransactions } = usePeriod();

  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    if (!allTransactions || !Array.isArray(allTransactions)) {
        return groups;
    }
    const sorted = [...allTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    sorted.forEach((transaction) => {
      const month = format(new Date(transaction.date), 'yyyy-MM');
      if (!groups[month]) {
        groups[month] = [];
      }
      groups[month].push(transaction);
    });
    return groups;
  }, [allTransactions]);

  const monthSummaries = useMemo(() => {
    const summaries: { [key: string]: { income: number; expense: number } } = {};
    for (const month in groupedTransactions) {
      const monthlyTxs = groupedTransactions[month];
      const income = monthlyTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = monthlyTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      summaries[month] = { income, expense };
    }
    return summaries;
  }, [groupedTransactions]);

  const sortedMonths = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Transacciones</h1>
          <p className="text-muted-foreground">
            Aquí puedes ver y gestionar todos tus movimientos, agrupados por mes.
          </p>
        </div>
        <AddTransactionDialog onTransactionAdded={refreshTransactions} />
      </div>

      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-52 rounded-md" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </CardContent>
        </Card>
      ) : sortedMonths.length > 0 ? (
        <Card>
            <CardHeader>
                <CardTitle>Historial de Transacciones</CardTitle>
                <CardDescription>Haz clic en un mes para expandir y ver los detalles de las transacciones.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center p-4 font-medium text-muted-foreground border-b">
                    <div className="flex-1">Mes</div>
                    <div className="w-48 text-right">Ingresos</div>
                    <div className="w-48 text-right">Gastos</div>
                    <div className="w-12 text-right"></div>
                </div>
                <Accordion type="single" collapsible className="w-full" defaultValue="item-0">
                {sortedMonths.map((month, index) => {
                  const summary = monthSummaries[month];
                  const [year, monthNum] = month.split('-');
                  const monthDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);

                  return (
                    <AccordionItem value={`item-${index}`} key={month} className="border-b-0">
                      <AccordionTrigger className="hover:bg-muted/50 rounded-md transition-colors py-0 [&[data-state=open]>svg]:rotate-180]">
                        <div className="flex flex-1 items-center font-normal p-4">
                            <div className="flex-1">
                                <span className="text-base font-medium capitalize">
                                    {format(monthDate, 'MMMM yyyy', { locale: es })}
                                </span>
                            </div>
                            <div className="w-48 text-right font-semibold flex items-center justify-end gap-1.5 text-green-600">
                                <TrendingUp className="h-4 w-4" />
                                {formatCurrency(summary.income)}
                            </div>
                            <div className="w-48 text-right font-semibold flex items-center justify-end gap-1.5 text-red-600">
                                <TrendingDown className="h-4 w-4" />
                                {formatCurrency(summary.expense)}
                            </div>
                        </div>
                         <div className="w-12 flex justify-end pr-4">
                            <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200" />
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-1 bg-muted/20">
                        <TransactionsTable transactions={groupedTransactions[month]} />
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
                </Accordion>
            </CardContent>
        </Card>
      ) : (
        <Card>
            <CardHeader>
                <CardTitle>Historial de Transacciones</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-center text-muted-foreground py-12 border-2 border-dashed rounded-lg">
                    <p className="font-medium">No hay transacciones registradas.</p>
                    <p className="text-sm">¡Usa el botón "Añadir Transacción" para empezar!</p>
                </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
