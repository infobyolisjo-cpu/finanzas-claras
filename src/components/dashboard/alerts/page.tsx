
'use client';

import { useMemo, useEffect, useState } from 'react';
import { useReconciliation } from '@/context/reconciliation-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Bell, Info, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePeriod } from '@/context/period-context';
import { getUserBudgets } from '@/lib/firestore';
import type { Budget, Transaction } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';


export default function AlertsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const { alerts: reconciliationAlerts, bankStatementTransactions } = useReconciliation();
    const { selectedPeriod, currentPeriodTransactions, loading: periodLoading } = usePeriod();
    
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loadingBudgets, setLoadingBudgets] = useState(false);

    useEffect(() => {
        const fetchBudgets = async () => {
            if(user && selectedPeriod) {
                setLoadingBudgets(true);
                try {
                   const userBudgets = await getUserBudgets(user.uid, selectedPeriod);
                   setBudgets(userBudgets);
                } catch(e) {
                   toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los presupuestos para generar alertas.'});
                } finally {
                    setLoadingBudgets(false);
                }
            }
        };
        fetchBudgets();
    }, [user, selectedPeriod, toast]);
    
    const generatedAlerts = useMemo(() => {
        const newAlerts: any[] = [...reconciliationAlerts];

        const transactionsToAnalyze = bankStatementTransactions.length > 0 
            ? bankStatementTransactions 
            : currentPeriodTransactions;
        
        // Budget alerts
        budgets.forEach(budget => {
            const spent = transactionsToAnalyze
                .filter(t => t.type === 'expense' && t.category === budget.category)
                .reduce((sum, t) => sum + Math.abs(t.amount), 0);

            if (spent > budget.amount) {
                 newAlerts.push({
                    id: `budget-exceeded-${budget.category}-${selectedPeriod}`,
                    title: `Presupuesto Excedido: ${budget.category}`,
                    description: `Has gastado ${spent} de un presupuesto de ${budget.amount} para ${format(new Date(selectedPeriod + '-02'), 'MMMM yyyy', {locale: es})}.`,
                    severity: 'error',
                    date: new Date().toISOString(),
                });
            } else if (spent >= budget.amount * 0.8) {
                 newAlerts.push({
                    id: `budget-near-${budget.category}-${selectedPeriod}`,
                    title: `Presupuesto Casi Agotado: ${budget.category}`,
                    description: `Has gastado ${spent} de un presupuesto de ${budget.amount} (más del 80%).`,
                    severity: 'warning',
                    date: new Date().toISOString(),
                });
            }
        });
        
        // Unusual spending alert
        const categoryAverages = transactionsToAnalyze
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => {
                if (!acc[t.category]) acc[t.category] = { total: 0, count: 0 };
                acc[t.category].total += Math.abs(t.amount);
                acc[t.category].count++;
                return acc;
            }, {} as Record<string, {total: number, count: number}>);
            
        transactionsToAnalyze.forEach(t => {
            if (t.type === 'expense') {
                const avg = categoryAverages[t.category]?.total / categoryAverages[t.category]?.count;
                if (avg && Math.abs(t.amount) > avg * 2 && categoryAverages[t.category].count > 2) {
                    newAlerts.push({
                        id: `unusual-spend-${t.id}`,
                        title: 'Gasto Inusual Detectado',
                        description: `Un gasto de ${Math.abs(t.amount)} en ${t.category} es mucho más alto que el promedio de ${avg.toFixed(2)} para esa categoría.`,
                        severity: 'warning',
                        date: new Date().toISOString(),
                    });
                }
            }
        });


        // Deduplicate alerts
        const uniqueAlerts = new Map(newAlerts.map(a => [a.id, a]));
        return Array.from(uniqueAlerts.values()).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    }, [reconciliationAlerts, bankStatementTransactions, currentPeriodTransactions, budgets, selectedPeriod]);

    const getIconAndColor = (severity: 'info' | 'warning' | 'error') => {
        switch (severity) {
            case 'info':
                return { Icon: Info, color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-900/30' };
            case 'warning':
                return { Icon: AlertTriangle, color: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-900/30' };
            case 'error':
                return { Icon: ShieldAlert, color: 'text-negative', bgColor: 'bg-red-50 dark:bg-red-900/30' };
        }
    };

    const loading = periodLoading || loadingBudgets;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Alertas</h1>
                    <p className="text-muted-foreground">Notificaciones inteligentes sobre tus finanzas del período seleccionado.</p>
                </div>
            </div>
            
            {loading ? (
                <p>Generando alertas...</p>
            ) : generatedAlerts.length > 0 ? (
                <div className="grid gap-6">
                    {generatedAlerts.map(alert => {
                        const { Icon, color, bgColor } = getIconAndColor(alert.severity);
                        return (
                            <Card key={alert.id} className={`${bgColor} border-l-4 ${color.replace('text-', 'border-')}`}>
                                <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-4">
                                    <Icon className={`h-6 w-6 ${color}`} />
                                    <div className="flex-1">
                                        <CardTitle className="text-lg">{alert.title}</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="text-xs shrink-0">
                                        {format(new Date(alert.date), 'dd MMMM, yyyy', { locale: es })}
                                    </Badge>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground">{alert.description}</p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Bell className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="font-medium text-lg">No hay alertas nuevas.</p>
                    <p className="text-sm">No se detectaron alertas para el período seleccionado. Prueba a cargar un extracto o cambiar el mes.</p>
                </div>
            )}
        </div>
    );
}

    
