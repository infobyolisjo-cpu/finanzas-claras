import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { ArrowDownCircle, ArrowUpCircle, Banknote, ShoppingCart, Activity, Landmark } from 'lucide-react';

type SummaryCardsProps = {
  income: number;
  expenses: number;
  realConsumption: number;
  avgDailySpending: number;
};

export function SummaryCards({ income, expenses, realConsumption, avgDailySpending }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ingresos del mes</CardTitle>
          <Landmark className="h-4 w-4 text-positive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-positive">{formatCurrency(income)}</div>
          <p className="text-xs text-muted-foreground">Total de ingresos reales</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Egresos del banco</CardTitle>
          <ArrowDownCircle className="h-4 w-4 text-negative" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-negative">{formatCurrency(expenses)}</div>
          <p className="text-xs text-muted-foreground">Total de débitos (incluye transferencias)</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gasto real (consumo)</CardTitle>
          <ShoppingCart className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(realConsumption)}</div>
           <p className="text-xs text-muted-foreground">Suma de compras y cargos</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gasto diario (consumo)</CardTitle>
          <Activity className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(avgDailySpending)}</div>
          <p className="text-xs text-muted-foreground">Promedio de gasto diario</p>
        </CardContent>
      </Card>
    </div>
  );
}
