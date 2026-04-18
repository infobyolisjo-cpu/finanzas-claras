'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BrainCircuit, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { CATEGORY_ICONS, TRANSACTION_CATEGORIES } from '@/lib/constants';
import Link from 'next/link';
import { subMonths, format, startOfMonth, endOfMonth }from 'date-fns';
import { usePeriod } from '@/context/period-context';

interface CategorySummary {
  key: string;
  label: string;
  icon: React.ElementType;
  total: number;
  count: number;
  percentage: number;
  previousTotal: number;
  change: number;
}

export default function CategoriesPage() {
    const { allTransactions, loading, currentPeriodTransactions } = usePeriod();

    const previousMonthTransactions = useMemo(() => {
        if (!allTransactions.length) return [];

        const [year, month] = allTransactions[0] ? format(new Date(allTransactions[0].date), 'yyyy-MM').split('-') : [new Date().getFullYear(), new Date().getMonth() + 1];
        const currentPeriodDate = new Date(Number(year), Number(month) - 1, 15); // Use a mid-month day to be safe

        const prevDate = subMonths(currentPeriodDate, 1);
        const prevMonthStart = startOfMonth(prevDate).getTime();
        const prevMonthEnd = endOfMonth(prevDate).getTime();
        
        return allTransactions.filter(t => {
            const tDate = new Date(t.date).getTime();
            return tDate >= prevMonthStart && tDate <= prevMonthEnd;
        });

    }, [allTransactions]);

    const categoriesSummary: CategorySummary[] = useMemo(() => {
        const expenseTransactions = currentPeriodTransactions.filter(t => t.type === 'expense');
        const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);

        const summary = expenseTransactions.reduce((acc, t) => {
            const category = t.category || 'other';
            if (!acc[category]) {
                acc[category] = { total: 0, count: 0 };
            }
            acc[category].total += t.amount;
            acc[category].count++;
            return acc;
        }, {} as Record<string, { total: number; count: number }>);
        
        const previousSummary = previousMonthTransactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => {
                const category = t.category || 'other';
                if (!acc[category]) acc[category] = 0;
                acc[category] += t.amount;
                return acc;
            }, {} as Record<string, number>);

        return Object.entries(summary)
            .map(([key, value]) => {
                const categoryInfo = TRANSACTION_CATEGORIES.find(c => c.value === key);
                const previousTotal = previousSummary[key] || 0;
                const change = value.total - previousTotal;

                return {
                    ...value,
                    key,
                    label: categoryInfo?.label || key.charAt(0).toUpperCase() + key.slice(1),
                    icon: CATEGORY_ICONS[key] || BrainCircuit,
                    percentage: totalExpenses > 0 ? (value.total / totalExpenses) * 100 : 0,
                    previousTotal,
                    change,
                };
            })
            .sort((a, b) => b.total - a.total);

    }, [currentPeriodTransactions, previousMonthTransactions]);

    const ChangeIndicator = ({ change }: { change: number }) => {
        if (change > 0) {
            return <span className="flex items-center text-xs text-negative"><ArrowUp className="h-3 w-3 mr-1" /> {formatCurrency(change)}</span>;
        }
        if (change < 0) {
            return <span className="flex items-center text-xs text-green-500"><ArrowDown className="h-3 w-3 mr-1" /> {formatCurrency(Math.abs(change))}</span>;
        }
        return <span className="flex items-center text-xs text-muted-foreground"><Minus className="h-3 w-3 mr-1" /> estable</span>;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Desglose de Gastos por Categoría</h1>
                    <p className="text-muted-foreground">Analiza tus gastos del período seleccionado y compáralos con el mes anterior.</p>
                </div>
            </div>

            {loading ? (
                <p>Cargando datos...</p>
            ) : allTransactions.length > 0 ? (
                 categoriesSummary.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {categoriesSummary.map(cat => (
                            <Card key={cat.key} className="flex flex-col">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center gap-3">
                                        <cat.icon className="h-6 w-6 text-muted-foreground" />
                                        <CardTitle className="text-lg">{cat.label}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow flex flex-col justify-between">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-2xl font-bold">{formatCurrency(cat.total)}</p>
                                            <p className="text-sm text-muted-foreground">{cat.count} {cat.count === 1 ? 'transacción' : 'transacciones'}</p>
                                        </div>
                                         <div className="text-sm text-muted-foreground">
                                            <p>Mes anterior: {formatCurrency(cat.previousTotal)}</p>
                                            <ChangeIndicator change={cat.change} />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-sm text-muted-foreground mb-1">
                                                <span>Porcentaje del total</span>
                                                <span>{cat.percentage.toFixed(1)}%</span>
                                            </div>
                                            <Progress value={cat.percentage} aria-label={`${cat.percentage.toFixed(1)}% del gasto total`} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                     <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
                        <h2 className="text-lg font-semibold text-foreground">No hay gastos en el período seleccionado.</h2>
                     </div>
                )
            ) : (
                <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
                    <BrainCircuit className="mx-auto h-12 w-12 text-primary/50 mb-4" />
                    <h2 className="text-lg font-semibold text-foreground">Aún no hay datos guardados</h2>
                    <p className="text-sm max-w-2xl mx-auto mt-2">
                        Esta vista se activa cuando decides guardar las transacciones desde la pestaña de <Link href="/dashboard/reconciliation" className="font-semibold text-primary hover:underline">Importar Movimientos</Link>.
                    </p>
                     <p className="text-sm max-w-2xl mx-auto mt-2">
                       Al guardar tus extractos, podrás ver aquí el análisis histórico de tus gastos, comparativas mensuales y mucho más.
                    </p>
                </div>
            )}
        </div>
    );
}
