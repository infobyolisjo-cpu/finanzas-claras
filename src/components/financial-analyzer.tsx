'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Sparkles, Loader2 } from 'lucide-react';

const STORAGE_KEY = 'fc-quick-analysis';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function FinancialAnalyzer() {
  const [income, setIncome] = useState('');
  const [expenses, setExpenses] = useState('');
  const [result, setResult] = useState<{
    balance: number;
    savingsRate: number;
    status: 'positive' | 'negative' | 'neutral';
  } | null>(null);
  const [recommendation, setRecommendation] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { income, expenses } = JSON.parse(saved);
        setIncome(income ?? '');
        setExpenses(expenses ?? '');
      }
    } catch {}
  }, []);

  const handleAnalyze = async () => {
    const inc = parseFloat(income.replace(/,/g, '')) || 0;
    const exp = parseFloat(expenses.replace(/,/g, '')) || 0;
    const balance = inc - exp;
    const savingsRate = inc > 0 ? (balance / inc) * 100 : 0;

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ income, expenses }));

    setResult({
      balance,
      savingsRate,
      status: balance < 0 ? 'negative' : balance === 0 ? 'neutral' : 'positive',
    });
    setRecommendation('');
    setLoadingAI(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ income: inc, expenses: exp }),
      });
      const data = await res.json();
      setRecommendation(data.recommendation);
    } catch {
      setRecommendation('Registra tus gastos diariamente para identificar oportunidades de ahorro.');
    } finally {
      setLoadingAI(false);
    }
  };

  const statusConfig = {
    positive: {
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
      label: 'Tienes margen de ahorro este mes.',
    },
    negative: {
      icon: TrendingDown,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
      label: 'Estás gastando más de lo que ingresas.',
    },
    neutral: {
      icon: Minus,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
      label: 'Ingresos y gastos están equilibrados.',
    },
  };

  return (
    <section className="container mx-auto px-4 py-16 md:py-20 max-w-2xl">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-headline font-extrabold tracking-tight text-foreground mb-3">
          Analiza tus finanzas ahora
        </h2>
        <p className="text-muted-foreground text-base md:text-lg">
          Sin registro. Sin complicaciones. Resultado inmediato.
        </p>
      </div>

      <Card className="border shadow-sm">
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="income" className="text-sm font-medium">
                Ingresos mensuales
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  id="income"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  className="pl-7 h-12 text-base"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expenses" className="text-sm font-medium">
                Gastos mensuales
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  id="expenses"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={expenses}
                  onChange={(e) => setExpenses(e.target.value)}
                  className="pl-7 h-12 text-base"
                />
              </div>
            </div>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={!income && !expenses}
            className="w-full h-12 text-base font-semibold"
          >
            Analizar mis finanzas
          </Button>

          {result && (
            <div className="space-y-4 pt-2">
              {/* Balance principal */}
              <div className={`rounded-xl border p-5 ${statusConfig[result.status].bg}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Saldo disponible</p>
                    <p className={`text-3xl font-extrabold font-headline ${statusConfig[result.status].color}`}>
                      {formatCurrency(result.balance)}
                    </p>
                  </div>
                  {(() => {
                    const Icon = statusConfig[result.status].icon;
                    return <Icon className={`h-10 w-10 ${statusConfig[result.status].color} opacity-80`} />;
                  })()}
                </div>
                <p className={`text-sm font-medium mt-3 ${statusConfig[result.status].color}`}>
                  {statusConfig[result.status].label}
                </p>
              </div>

              {/* Métricas secundarias */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/30 border p-4">
                  <p className="text-xs text-muted-foreground mb-1">Tasa de ahorro</p>
                  <p className="text-xl font-bold font-headline text-foreground">
                    {result.savingsRate > 0 ? `${result.savingsRate.toFixed(1)}%` : '0%'}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/30 border p-4">
                  <p className="text-xs text-muted-foreground mb-1">Gastos vs ingresos</p>
                  <p className="text-xl font-bold font-headline text-foreground">
                    {parseFloat(income) > 0
                      ? `${((parseFloat(expenses) / parseFloat(income)) * 100).toFixed(0)}%`
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Recomendación IA */}
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Recomendación IA</p>
                </div>
                {loadingAI ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analizando tu situación...</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed">{recommendation}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
