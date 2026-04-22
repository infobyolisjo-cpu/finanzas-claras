'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { usePeriod } from '@/context/period-context';
import type { Budget } from '@/lib/types';
import { getUserBudgets, saveBudget, deleteBudget } from '@/lib/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PiggyBank, PlusCircle, Trash2, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { TRANSACTION_CATEGORIES } from '@/lib/constants';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

export default function BudgetsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const { selectedPeriod, currentPeriodTransactions, loading: periodLoading } = usePeriod();

    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loadingBudgets, setLoadingBudgets] = useState(true);
    const [newBudgetCategory, setNewBudgetCategory] = useState('');
    const [newBudgetAmount, setNewBudgetAmount] = useState('');
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchBudgets = async () => {
        if (!user || !selectedPeriod) return;
        setLoadingBudgets(true);
        try {
            setBudgets(await getUserBudgets(user.uid, selectedPeriod));
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los presupuestos.' });
        } finally {
            setLoadingBudgets(false);
        }
    };

    useEffect(() => {
        if (user && selectedPeriod) fetchBudgets();
    }, [user, selectedPeriod]);

    // Calculate actual spend per category from current period transactions
    const budgetStatus = useMemo(() => {
        const expenses = currentPeriodTransactions.filter(t => t.type === 'expense');
        const totalIncome = currentPeriodTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
        const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);

        const items = budgets.map(budget => {
            const spent = expenses.filter(t => t.category === budget.category).reduce((s, t) => s + t.amount, 0);
            const pct   = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
            const remaining = budget.amount - spent;
            const status: 'ok' | 'near' | 'exceeded' = pct > 100 ? 'exceeded' : pct >= 80 ? 'near' : 'ok';
            return { ...budget, spent, pct, remaining, status };
        });

        return { items, totalIncome, totalExpenses, totalBudgeted };
    }, [budgets, currentPeriodTransactions]);

    const handleAddBudget = async () => {
        if (!user || !newBudgetCategory || !newBudgetAmount) return;
        const amount = parseFloat(newBudgetAmount);
        if (isNaN(amount) || amount <= 0) {
            toast({ variant: 'destructive', title: 'Monto inválido', description: 'Ingresa un número mayor a cero.' });
            return;
        }
        setSaving(true);
        try {
            await saveBudget(user.uid, { userId: user.uid, category: newBudgetCategory, amount, period: selectedPeriod });
            await fetchBudgets();
            toast({ title: 'Presupuesto guardado' });
            setNewBudgetCategory('');
            setNewBudgetAmount('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (budget: Budget) => {
        if (!user || !budget.id) return;
        setDeletingId(budget.id);
        try {
            await deleteBudget(user.uid, budget.id);
            await fetchBudgets();
            toast({ title: 'Presupuesto eliminado' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setDeletingId(null);
        }
    };

    const availableCategories = TRANSACTION_CATEGORIES.filter(
        c => c.type === 'expense' && !budgets.some(b => b.category === c.value)
    );

    const periodLabel = useMemo(() => {
        try { return format(parseISO(selectedPeriod + '-01'), 'MMMM yyyy', { locale: es }); }
        catch { return selectedPeriod; }
    }, [selectedPeriod]);

    const loading = periodLoading || loadingBudgets;

    const statusColor = (s: 'ok' | 'near' | 'exceeded') =>
        s === 'exceeded' ? 'text-rose-500' : s === 'near' ? 'text-amber-500' : 'text-emerald-500';

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">Presupuestos</h1>
                <p className="text-muted-foreground">Planifica tus gastos por categoría y controla si los estás cumpliendo.</p>
            </div>

            {/* Summary KPIs */}
            {!loading && budgets.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-5">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-sm text-muted-foreground">Presupuesto total</p>
                                <Wallet className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="text-2xl font-bold">{formatCurrency(budgetStatus.totalBudgeted)}</p>
                            <p className="text-xs text-muted-foreground mt-1">{budgets.length} categoría{budgets.length > 1 ? 's' : ''} presupuestada{budgets.length > 1 ? 's' : ''}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-5">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-sm text-muted-foreground">Gastado hasta ahora</p>
                                <TrendingDown className="h-4 w-4 text-rose-500" />
                            </div>
                            <p className="text-2xl font-bold text-rose-500">{formatCurrency(budgetStatus.totalExpenses)}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {budgetStatus.totalBudgeted > 0
                                    ? `${Math.round((budgetStatus.totalExpenses / budgetStatus.totalBudgeted) * 100)}% del presupuesto`
                                    : 'Sin presupuesto asignado'}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-5">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-sm text-muted-foreground">Disponible</p>
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                            </div>
                            <p className={`text-2xl font-bold ${budgetStatus.totalBudgeted - budgetStatus.totalExpenses >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {formatCurrency(budgetStatus.totalBudgeted - budgetStatus.totalExpenses)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Para gastar en {periodLabel}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Add budget form — always visible */}
            <Card>
                <CardHeader>
                    <CardTitle>Agregar presupuesto</CardTitle>
                    <CardDescription>
                        Define cuánto puedes gastar por categoría en <strong>{periodLabel}</strong>.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <label className="text-sm font-medium block mb-1.5">Categoría</label>
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
                    <div className="flex-1">
                        <label className="text-sm font-medium block mb-1.5">Monto límite</label>
                        <Input
                            type="number"
                            placeholder="Ej: 5000"
                            value={newBudgetAmount}
                            onChange={e => setNewBudgetAmount(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddBudget()}
                        />
                    </div>
                    <Button onClick={handleAddBudget} disabled={!newBudgetCategory || !newBudgetAmount || saving}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Agregar
                    </Button>
                </CardContent>
            </Card>

            {/* Budget list */}
            {loading ? (
                <p className="text-muted-foreground text-sm">Cargando...</p>
            ) : budgetStatus.items.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {budgetStatus.items.map(b => {
                        const catLabel = TRANSACTION_CATEGORIES.find(c => c.value === b.category)?.label ?? b.category;
                        return (
                            <Card key={b.category} className="relative">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="text-base">{catLabel}</CardTitle>
                                            <CardDescription>Límite: {formatCurrency(b.amount)}</CardDescription>
                                        </div>
                                        <Button
                                            variant="ghost" size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                                            disabled={deletingId === b.id}
                                            onClick={() => handleDelete(b)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <Progress
                                        value={Math.min(b.pct, 100)}
                                        className={`h-2 ${b.status === 'exceeded' ? '[&>*]:bg-rose-500' : b.status === 'near' ? '[&>*]:bg-amber-500' : '[&>*]:bg-emerald-500'}`}
                                    />
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Gastado: <span className="font-medium text-foreground">{formatCurrency(b.spent)}</span></span>
                                        <span className={`font-medium ${statusColor(b.status)}`}>
                                            {b.status === 'exceeded'
                                                ? `+${formatCurrency(Math.abs(b.remaining))} excedido`
                                                : `${formatCurrency(b.remaining)} restante`}
                                        </span>
                                    </div>
                                    <p className={`text-xs font-medium ${statusColor(b.status)}`}>
                                        {b.pct.toFixed(0)}% consumido
                                        {b.status === 'exceeded' && ' — ⚠️ Límite superado'}
                                        {b.status === 'near' && ' — Cerca del límite'}
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
                    <PiggyBank className="mx-auto h-12 w-12 text-primary/50 mb-4" />
                    <p className="font-medium text-foreground">Sin presupuestos para {periodLabel}</p>
                    <p className="text-sm mt-1">Agrega tu primer presupuesto arriba para empezar a controlar tus gastos.</p>
                </div>
            )}
        </div>
    );
}
