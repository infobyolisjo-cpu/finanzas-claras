'use client';

import type { Transaction } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { eachWeekOfInterval, endOfMonth, format, startOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTheme } from 'next-themes';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type WeeklySummaryChartProps = {
  transactions: Transaction[];
};

export function WeeklySummaryChart({ transactions }: WeeklySummaryChartProps) {
  const { theme } = useTheme();
  const colors = {
    'light': { text: '#334155' },
    'dark': { text: '#cbd5e1' }
  };
  const currentColors = colors[theme as keyof typeof colors] || colors['light'];
  
  if (transactions.length === 0) {
     return (
        <div className="h-[350px] w-full flex items-center justify-center text-muted-foreground text-sm">
            No hay datos para mostrar el resumen semanal.
        </div>
    );
  }

  const periodDate = new Date(transactions[0].date);
  const start = startOfMonth(periodDate);
  const end = endOfMonth(periodDate);
  const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });

  const weeklyData = weeks.map((weekStart, index) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const weekTransactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= weekStart && tDate <= weekEnd;
    });

    const income = weekTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = weekTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    
    return {
        name: `Semana ${index + 1}`,
        Ingresos: income,
        Gastos: expense,
    };
  });

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer>
        <BarChart data={weeklyData}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis
            dataKey="name"
            stroke={currentColors.text}
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke={currentColors.text}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value / 1000}k`}
          />
          <Tooltip
            cursor={{ fill: 'hsla(var(--muted))' }}
            contentStyle={{
                backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                borderColor: theme === 'dark' ? '#334155' : '#e2e8f0'
            }}
            formatter={(value: number, name: string) => [formatCurrency(value), name]}
          />
          <Bar dataKey="Ingresos" fill="hsl(var(--positive))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Gastos" fill="hsl(var(--negative))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
