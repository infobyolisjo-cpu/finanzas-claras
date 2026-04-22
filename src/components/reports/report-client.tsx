'use client';

import { useMemo } from 'react';
import { usePeriod } from '@/context/period-context';
import { formatCurrency } from '@/lib/utils';
import { TRANSACTION_CATEGORIES } from '@/lib/constants';
import { format, subMonths, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTheme } from 'next-themes';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryDonutChart } from '@/components/analysis/category-donut-chart';
import type { Transaction } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function totals(txs: Transaction[]) {
  const income   = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return { income, expenses, net: income - expenses };
}

function pct(value: number, base: number) {
  if (base === 0) return 0;
  return Math.round((value / base) * 100);
}

function delta(current: number, previous: number) {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
  deltaValue,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  sub?: string;
  deltaValue?: number | null;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <div className="flex items-center gap-2 mt-1 min-h-[18px]">
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          {deltaValue !== null && deltaValue !== undefined && (
            <span className={`text-xs font-medium flex items-center gap-0.5 ${deltaValue > 0 ? 'text-emerald-500' : deltaValue < 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
              {deltaValue > 0 ? <ArrowUp className="h-3 w-3" /> : deltaValue < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {Math.abs(deltaValue)}% vs mes anterior
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Cash Flow Chart ───────────────────────────────────────────────────────────

function CashFlowChart({ allTransactions }: { allTransactions: Transaction[] }) {
  const { theme } = useTheme();
  const textColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  const gridColor = theme === 'dark' ? '#1e293b' : '#f1f5f9';

  const data = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const month = subMonths(now, 5 - i);
      const key   = format(month, 'yyyy-MM');
      const label = format(month, 'MMM', { locale: es });
      const txs   = allTransactions.filter(t => t.period === key);
      const { income, expenses } = totals(txs);
      return { mes: label, Ingresos: income, Gastos: expenses };
    });
  }, [allTransactions]);

  const hasData = data.some(d => d.Ingresos > 0 || d.Gastos > 0);

  if (!hasData) {
    return (
      <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
        Sin datos suficientes para mostrar el flujo de caja.
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }} barSize={16} barGap={4}>
          <CartesianGrid vertical={false} stroke={gridColor} />
          <XAxis dataKey="mes" tick={{ fill: textColor, fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: textColor, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{
              backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
              borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
              fontSize: 13,
            }}
            formatter={(v: number) => formatCurrency(v)}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Gastos"   fill="#f43f5e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Top Gastos ────────────────────────────────────────────────────────────────

function TopExpenses({ transactions }: { transactions: Transaction[] }) {
  const top = useMemo(() => {
    const byCategory = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        const key = t.category || 'other';
        acc[key] = (acc[key] ?? 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    const total = Object.values(byCategory).reduce((s, v) => s + v, 0);

    return Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([cat, amount]) => ({
        label: TRANSACTION_CATEGORIES.find(c => c.value === cat)?.label ?? cat,
        amount,
        pct: total > 0 ? Math.round((amount / total) * 100) : 0,
      }));
  }, [transactions]);

  if (top.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sin gastos en este período.</p>;
  }

  return (
    <ul className="space-y-3">
      {top.map(({ label, amount, pct: p }) => (
        <li key={label}>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium truncate max-w-[160px]">{label}</span>
            <span className="text-muted-foreground">{formatCurrency(amount)} · {p}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-rose-400" style={{ width: `${p}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ReportClient() {
  const { selectedPeriod, currentPeriodTransactions, allTransactions, loading } = usePeriod();

  const prevPeriod = useMemo(() => {
    const d = parseISO(selectedPeriod + '-01');
    return format(subMonths(d, 1), 'yyyy-MM');
  }, [selectedPeriod]);

  const prevTxs  = useMemo(() => allTransactions.filter(t => t.period === prevPeriod), [allTransactions, prevPeriod]);
  const curr     = useMemo(() => totals(currentPeriodTransactions), [currentPeriodTransactions]);
  const prev     = useMemo(() => totals(prevTxs), [prevTxs]);
  const margin   = pct(curr.net, curr.income);

  const periodLabel = useMemo(() => {
    try { return format(parseISO(selectedPeriod + '-01'), 'MMMM yyyy', { locale: es }); }
    catch { return selectedPeriod; }
  }, [selectedPeriod]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Ingresos"
          value={formatCurrency(curr.income)}
          icon={TrendingUp}
          color="text-emerald-500"
          deltaValue={delta(curr.income, prev.income)}
        />
        <KpiCard
          label="Gastos"
          value={formatCurrency(curr.expenses)}
          icon={TrendingDown}
          color="text-rose-500"
          deltaValue={delta(curr.expenses, prev.expenses)}
        />
        <KpiCard
          label="Utilidad neta"
          value={formatCurrency(curr.net)}
          icon={Wallet}
          color={curr.net >= 0 ? 'text-foreground' : 'text-rose-500'}
          sub={curr.net >= 0 ? 'Resultado positivo' : 'Gastos superan ingresos'}
        />
        <KpiCard
          label="Margen de ahorro"
          value={`${margin}%`}
          icon={PiggyBank}
          color={margin >= 20 ? 'text-emerald-500' : margin >= 5 ? 'text-amber-500' : 'text-rose-500'}
          sub={margin >= 20 ? 'Excelente' : margin >= 5 ? 'Mejorable' : 'Crítico'}
        />
      </div>

      {/* Cash Flow 6 meses */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Flujo de caja — últimos 6 meses</CardTitle>
          <CardDescription>Ingresos y gastos mes a mes para detectar tendencias.</CardDescription>
        </CardHeader>
        <CardContent>
          <CashFlowChart allTransactions={allTransactions} />
        </CardContent>
      </Card>

      {/* Desglose */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top gastos por categoría</CardTitle>
            <CardDescription>{periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <TopExpenses transactions={currentPeriodTransactions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribución de gastos</CardTitle>
            <CardDescription>{periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryDonutChart transactions={currentPeriodTransactions} />
          </CardContent>
        </Card>
      </div>

      {/* Tabla top transacciones */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Gastos más altos del mes</CardTitle>
          <CardDescription>Las 8 transacciones individuales de mayor monto.</CardDescription>
        </CardHeader>
        <CardContent>
          <TopTransactions transactions={currentPeriodTransactions} />
        </CardContent>
      </Card>

    </div>
  );
}

// ── Top Transactions Table ────────────────────────────────────────────────────

function TopTransactions({ transactions }: { transactions: Transaction[] }) {
  const top = useMemo(() =>
    transactions
      .filter(t => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8),
    [transactions]
  );

  if (top.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Sin gastos en este período.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="text-left pb-2 font-medium">Descripción</th>
            <th className="text-left pb-2 font-medium hidden sm:table-cell">Categoría</th>
            <th className="text-left pb-2 font-medium hidden sm:table-cell">Fecha</th>
            <th className="text-right pb-2 font-medium">Monto</th>
          </tr>
        </thead>
        <tbody>
          {top.map(t => (
            <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="py-2.5 pr-4 max-w-[200px] truncate font-medium">{t.descriptionRaw}</td>
              <td className="py-2.5 pr-4 text-muted-foreground hidden sm:table-cell">
                {TRANSACTION_CATEGORIES.find(c => c.value === t.category)?.label ?? 'Otro'}
              </td>
              <td className="py-2.5 pr-4 text-muted-foreground hidden sm:table-cell">
                {format(new Date(t.date), 'dd MMM', { locale: es })}
              </td>
              <td className="py-2.5 text-right text-rose-500 font-semibold">
                {formatCurrency(t.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
