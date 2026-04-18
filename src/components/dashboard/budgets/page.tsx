'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { usePeriod } from '@/context/period-context';
import type { Transaction, Budget } from '@/lib/types';
import { getUserBudgets, saveBudget } from '@/lib/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PiggyBank, PlusCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { TRANSACTION_CATEGORIES } from '@/lib/constants';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

export default function BudgetsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const { selectedPeriod, currentPeriodTransactions, loading: periodLoading, allTransactions } = usePeriod();

    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loadingBudgets, setLoadingBudgets] = useState(true);
    
    const [newBudgetCategory, setNewBudgetCategory] = useState('');
    const [newBudgetAmount, setNewBudgetAmount] = useState('');
    
    const fetchBudgets = async () => {
        if (user) {
            setLoadingBudgets(true);
            try {
                const userBudgets = await getUserBudgets(user.uid, selectedPeriod);
                setBudgets(userBudgets);
            } catch (error) {
                console.error("Failed to fetch budgets:", error);
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'No se pudieron cargar los presupuestos.'
                });
            } finally {
                setLoadingBudgets(false);
            }
        }
    };

    useEffect(() => {
        if(user && selectedPeriod) {
            fetchBudgets();
        }
    }, [user, selectedPeriod]);

    const budgetStatus = useMemo(() => {
        const expenseTransactionsThisPeriod = currentPeriodTransactions.filter(t => t.type === 'expense');
        
        return budgets.map(budget => {
            const spent = expenseTransactionsThisPeriod
                .filter(t => t.category === budget.category)
                .reduce((sum, t) => sum + t.amount, 0);
            const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
            const remaining = budget.amount - spent;

            let status: 'ok' | 'near' | 'exceeded' = 'ok';
            if (percentage > 100) status = 'exceeded';
            else if (percentage >= 80) status = 'near';

            return { ...budget, spent, percentage, remaining, status };
        });
    }, [budgets, currentPeriodTransactions]);

    const handleAddBudget = async () => {
        if (!user || !newBudgetCategory || !newBudgetAmount) return;
        
        const amount = parseFloat(newBudgetAmount);
        if (isNaN(amount) || amount <= 0) {
            toast({ variant: 'destructive', title: 'Monto inválido', description: 'El monto del presupuesto debe ser un número mayor a cero.' });
            return;
        }

        const newBudget: Budget = { 
            userId: user.uid,
            category: newBudgetCategory, 
            amount,
            period: selectedPeriod,
        };

        try {
            await saveBudget(user.uid, newBudget);
            
            await fetchBudgets(); // Refetch budgets to get the latest state

            toast({ title: '¡Presupuesto guardado!', description: 'Tu nuevo presupuesto se ha establecido correctamente.' });
            setNewBudgetCategory('');
            setNewBudgetAmount('');
        } catch (error: any) {
            console.error("Failed to save budget:", error);
            toast({ variant: 'destructive', title: 'Error al guardar', description: 'No se pudo guardar el presupuesto. ' + error.message });
        }
    };
    
    const getStatusColor = (status: 'ok' | 'near' | 'exceeded') => {
        if (status === 'exceeded') return 'bg-negative';
        if (status === 'near') return 'bg-orange-500';
        return 'bg-primary';
    };

    const availableCategories = TRANSACTION_CATEGORIES.filter(c => 
        c.type === 'expense' && !budgets.some(b => b.category === c.value)
    );
    
    const loading = periodLoading || loadingBudgets;
    const periodDate = new Date(`${selectedPeriod}-02`); // Use day 2 to avoid timezone issues

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Presupuestos</h1>
                    <p className="text-muted-foreground">Define y sigue tus presupuestos para el período seleccionado.</p>
                </div>
            </div>

            {loading ? (
                <p>Cargando datos...</p>
            ) : allTransactions.length > 0 ? (
                <>
                <Card>
                    <CardHeader>
                        <CardTitle>Crear Nuevo Presupuesto</CardTitle>
                        <CardDescription>Establece un límite de gasto para una categoría en {format(periodDate, 'MMMM yyyy', {locale: es})}.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className='flex-1'>
                             <label className='text-sm font-medium'>Categoría</label>
                            <Select onValueChange={setNewBudgetCategory} value={newBudgetCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Elige una categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableCategories.map(cat => (
                                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='flex-1'>
                            <label className='text-sm font-medium'>Monto del presupuesto</label>
                            <Input
                                type="number"
                                placeholder="Ej: 500"
                                value={newBudgetAmount}
                                onChange={(e) => setNewBudgetAmount(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleAddBudget} disabled={!newBudgetCategory || !newBudgetAmount}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Añadir
                        </Button>
                    </CardContent>
                </Card>

                {budgetStatus.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {budgetStatus.map(b => (
                            <Card key={b.category}>
                                <CardHeader>
                                    <CardTitle className="text-lg">{TRANSACTION_CATEGORIES.find(c=>c.value === b.category)?.label}</CardTitle>
                                    <CardDescription>Presupuesto: {formatCurrency(b.amount)}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <div className="flex justify-between font-medium">
                                            <span>Gastado: {formatCurrency(b.spent)}</span>
                                            <span className={b.remaining < 0 ? 'text-negative' : ''}>{b.remaining >= 0 ? `Quedan: ${formatCurrency(b.remaining)}` : `Excedido: ${formatCurrency(Math.abs(b.remaining))}`}</span>
                                        </div>
                                         <Progress value={Math.min(b.percentage, 100)} className={`mt-2 [&>*]:${getStatusColor(b.status)}`} />
                                    </div>
                                    <p className={`text-sm font-medium ${b.status === 'exceeded' ? 'text-negative' : 'text-muted-foreground'}`}>
                                        {b.percentage.toFixed(1)}% del presupuesto consumido.
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        <p className="font-medium">No has creado ningún presupuesto para este período.</p>
                        <p className="text-sm">¡Usa el formulario de arriba para empezar!</p>
                    </div>
                )}
                </>
            ) : (
                <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
                    <PiggyBank className="mx-auto h-12 w-12 text-primary/50 mb-4" />
                    <h2 className="text-lg font-semibold text-foreground">Los presupuestos requieren datos guardados</h2>
                    <p className="text-sm max-w-2xl mx-auto mt-2">
                        Para crear y seguir presupuestos, primero necesitas guardar transacciones desde la pestaña de <Link href="/dashboard/reconciliation" className="font-semibold text-primary hover:underline">Importar Movimientos</Link>.
                    </p>
                </div>
            )}
        </div>
    );
}
