'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const STORAGE_KEY = 'fc-quick-analysis';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const STATUS = {
  positive: {
    Icon: TrendingUp,
    color: 'text-bj-positive',
    border: 'border-bj-positive/20',
    bg: 'bg-bj-positive/[0.06]',
    label: 'Tienes margen de ahorro este mes.',
  },
  negative: {
    Icon: TrendingDown,
    color: 'text-bj-negative',
    border: 'border-bj-negative/20',
    bg: 'bg-bj-negative/[0.06]',
    label: 'Estás gastando más de lo que ingresas.',
  },
  neutral: {
    Icon: Minus,
    color: 'text-bj-warning',
    border: 'border-bj-warning/20',
    bg: 'bg-bj-warning/[0.06]',
    label: 'Ingresos y gastos están equilibrados.',
  },
};

export function FinancialAnalyzer() {
  const [income, setIncome] = useState('');
  const [expenses, setExpenses] = useState('');
  const [result, setResult] = useState<{
    balance: number;
    savingsRate: number;
    expenseRatio: number;
    status: 'positive' | 'negative' | 'neutral';
  } | null>(null);
  const [recommendation, setRecommendation] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setIncome(data.income ?? '');
        setExpenses(data.expenses ?? '');
      }
    } catch {}
  }, []);

  const handleAnalyze = async () => {
    const inc = parseFloat(income.replace(/,/g, '')) || 0;
    const exp = parseFloat(expenses.replace(/,/g, '')) || 0;
    const balance = inc - exp;
    const savingsRate = inc > 0 ? (balance / inc) * 100 : 0;
    const expenseRatio = inc > 0 ? (exp / inc) * 100 : 0;

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ income, expenses }));

    setResult({
      balance,
      savingsRate,
      expenseRatio,
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

  return (
    <section className="container mx-auto px-4 py-16 md:py-20 max-w-xl">

      {/* Eyebrow + título */}
      <div className="mb-10">
        <p className="text-eyebrow text-bj-text-secondary mb-3 tracking-eyebrow">
          Análisis rápido
        </p>
        <h2 className="font-display text-[28px] md:text-[34px] font-medium leading-tight text-foreground mb-2">
          Conoce tu situación ahora
        </h2>
        <p className="text-[14px] text-bj-text-tertiary leading-relaxed">
          Sin registro. Sin complicaciones. Resultado inmediato.
        </p>
      </div>

      {/* Formulario */}
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="income" className="text-[12px] font-medium text-bj-text-secondary uppercase tracking-[0.06em]">
              Ingresos mensuales
            </Label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bj-text-tertiary text-sm select-none">$</span>
              <Input
                id="income"
                type="number"
                min="0"
                placeholder="0"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expenses" className="text-[12px] font-medium text-bj-text-secondary uppercase tracking-[0.06em]">
              Gastos mensuales
            </Label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bj-text-tertiary text-sm select-none">$</span>
              <Input
                id="expenses"
                type="number"
                min="0"
                placeholder="0"
                value={expenses}
                onChange={(e) => setExpenses(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>
        </div>

        <Button
          variant="brand"
          size="lg"
          onClick={handleAnalyze}
          disabled={!income && !expenses}
          className="w-full"
        >
          Analizar mis finanzas
        </Button>
      </div>

      {/* Resultado */}
      {result && (() => {
        const s = STATUS[result.status];
        const Icon = s.Icon;
        return (
          <div className="mt-8 space-y-3">

            {/* Balance principal */}
            <div className={`rounded-md border ${s.border} ${s.bg} px-6 py-5`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium text-bj-text-secondary uppercase tracking-[0.08em] mb-2">
                    Saldo disponible
                  </p>
                  <p className={`font-display text-[38px] font-medium leading-none tabular-nums ${s.color}`}>
                    {formatCurrency(result.balance)}
                  </p>
                </div>
                <Icon className={`h-7 w-7 mt-1 ${s.color} opacity-70 shrink-0`} />
              </div>
              <p className={`text-[13px] font-medium mt-4 ${s.color}`}>
                {s.label}
              </p>
            </div>

            {/* Métricas secundarias */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-border bg-card px-5 py-4">
                <p className="text-[11px] text-bj-text-tertiary uppercase tracking-[0.06em] mb-2">Tasa de ahorro</p>
                <p className={`font-display text-[26px] font-medium tabular-nums ${result.savingsRate >= 0 ? 'text-bj-positive' : 'text-bj-negative'}`}>
                  {result.savingsRate.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-md border border-border bg-card px-5 py-4">
                <p className="text-[11px] text-bj-text-tertiary uppercase tracking-[0.06em] mb-2">Gastos / ingresos</p>
                <p className={`font-display text-[26px] font-medium tabular-nums ${result.expenseRatio > 100 ? 'text-bj-negative' : 'text-foreground'}`}>
                  {parseFloat(income) > 0 ? `${result.expenseRatio.toFixed(0)}%` : '—'}
                </p>
              </div>
            </div>

            {/* Recomendación IA */}
            <div className="rounded-md border border-border bg-card px-5 py-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-bj-premium shrink-0" />
                <p className="text-[11px] font-medium text-bj-text-secondary uppercase tracking-[0.08em]">
                  Recomendación
                </p>
              </div>
              {loadingAI ? (
                <div className="flex items-center gap-2 text-bj-text-tertiary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-[13px]">Analizando tu situación...</span>
                </div>
              ) : (
                <p className="text-[14px] text-bj-text-secondary leading-relaxed">{recommendation}</p>
              )}
            </div>

          </div>
        );
      })()}
    </section>
  );
}
