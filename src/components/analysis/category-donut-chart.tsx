'use client';

import * as React from 'react';
import type { Transaction } from '@/lib/types';
import { TRANSACTION_CATEGORIES } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import { Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts';
import { useTheme } from 'next-themes';

type CategoryDonutChartProps = {
  transactions: Transaction[];
};

const ActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const { theme } = useTheme();
    const textColor = theme === 'dark' ? '#cbd5e1' : '#334155';
  
    return (
      <g>
        <text x={cx} y={cy} dy={-5} textAnchor="middle" fill={textColor} className="text-base font-semibold">
          {payload.name}
        </text>
         <text x={cx} y={cy} dy={15} textAnchor="middle" fill={textColor} className="text-sm">
          {`${(percent * 100).toFixed(2)}%`}
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={textColor}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius * 1.05}
          outerRadius={outerRadius * 1.08}
          fill={textColor}
        />
      </g>
    );
  };

export function CategoryDonutChart({ transactions }: CategoryDonutChartProps) {
  const { theme } = useTheme();
  const textColor = theme === 'dark' ? '#cbd5e1' : '#334155';
  const [activeIndex, setActiveIndex] = React.useState(0);

  const onPieEnter = React.useCallback(
    (_: any, index: number) => {
      setActiveIndex(index);
    },
    [setActiveIndex]
  );
  
  const expenseData = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      const categoryLabel = TRANSACTION_CATEGORIES.find(c => c.value === t.category)?.label || t.category;
      if (!acc[categoryLabel]) {
        acc[categoryLabel] = 0;
      }
      acc[categoryLabel] += t.amount;
      return acc;
    }, {} as Record<string, number>);

  const chartData = Object.entries(expenseData)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return (
        <div className="h-[350px] w-full flex items-center justify-center text-muted-foreground text-sm">
            No hay gastos este mes.
        </div>
    );
  }

  return (
    <div className="h-[350px] w-full">
        <ResponsiveContainer>
            <PieChart>
            <Pie
              activeIndex={activeIndex}
              activeShape={ActiveShape}
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="80%"
              fill={textColor}
              dataKey="value"
              onMouseEnter={onPieEnter}
              stroke="hsl(var(--background))"
              strokeWidth={2}
            />
            <Tooltip
                contentStyle={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: theme === 'dark' ? '#334155' : '#e2e8f0'
                }}
                formatter={(value: number) => [formatCurrency(value), 'Total']}
            />
            </PieChart>
        </ResponsiveContainer>
    </div>
  );
}
