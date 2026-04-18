'use client';

import type { Transaction } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from 'date-fns';
import { useTheme } from 'next-themes';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type BalanceChartProps = {
  transactions: Transaction[];
};

export function BalanceChart({ transactions }: BalanceChartProps) {
  const { theme } = useTheme();
  const colors = {
    'light': { text: '#334155', fill: '#334155' },
    'dark': { text: '#cbd5e1', fill: '#cbd5e1' }
  };
  const currentColors = colors[theme as keyof typeof colors] || colors['light'];

  if (transactions.length === 0) {
     return (
        <div className="h-[350px] w-full flex items-center justify-center text-muted-foreground text-sm">
            No hay datos para mostrar el gráfico de balance.
        </div>
    );
  }

  const periodDate = new Date(transactions[0].date);

  const monthlyData = transactions.reduce((acc, t) => {
    const dateStr = format(new Date(t.date), 'yyyy-MM-dd');
    if (!acc[dateStr]) {
      acc[dateStr] = { income: 0, expense: 0 };
    }
    if (t.type === 'income') {
      acc[dateStr].income += t.amount;
    } else {
      acc[dateStr].expense += t.amount;
    }
    return acc;
  }, {} as Record<string, { income: number; expense: number }>);
  
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(periodDate),
    end: endOfMonth(periodDate),
  });

  let cumulativeBalance = 0;
  const chartData = daysInMonth.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayData = monthlyData[dateStr] || { income: 0, expense: 0 };
    cumulativeBalance += dayData.income - dayData.expense;
    return {
      date: format(day, 'dd MMM'),
      Saldo: cumulativeBalance,
    };
  });

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis 
            dataKey="date" 
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
            contentStyle={{ 
                backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                borderColor: theme === 'dark' ? '#334155' : '#e2e8f0'
            }}
            formatter={(value: number) => formatCurrency(value)} 
          />
          <defs>
            <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={currentColors.fill} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={currentColors.fill} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <Area 
            type="monotone" 
            dataKey="Saldo" 
            stroke={currentColors.fill}
            fill="url(#colorSaldo)"
            fillOpacity={1}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
