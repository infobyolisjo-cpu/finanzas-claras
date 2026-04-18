'use client';

import type { Transaction } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { CATEGORY_ICONS, TRANSACTION_CATEGORIES } from '@/lib/constants';
import { MoreHorizontal } from 'lucide-react';
import { Badge } from '../ui/badge';

type TransactionsTableProps = {
  transactions: Transaction[];
};

export function TransactionsTable({ transactions }: TransactionsTableProps) {
  if (!transactions || transactions.length === 0) {
    return (
        <div className="text-center text-muted-foreground py-12 border-2 border-dashed rounded-lg">
            <p className="font-medium">No hay transacciones para este período.</p>
        </div>
    )
  }

  // The transactions are already sorted by the parent component.
  const sortedTransactions = transactions;

  return (
    <div className="w-full">
        <Table>
        <TableHeader>
            <TableRow>
            <TableHead className="w-[120px] hidden sm:table-cell">Fecha</TableHead>
            <TableHead>Categoría y Nota</TableHead>
            <TableHead className="text-right w-[120px]">Monto</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {sortedTransactions.map((transaction) => {
                const Icon = CATEGORY_ICONS[transaction.category || 'other'] || MoreHorizontal;
                const categoryInfo = TRANSACTION_CATEGORIES.find(c => c.value === transaction.category);
                const categoryLabel = categoryInfo ? categoryInfo.label : (transaction.category || 'Otro');
                
                return (
                    <TableRow key={transaction.id}>
                        <TableCell className="font-medium hidden sm:table-cell">
                            {format(new Date(transaction.date), 'dd MMM yyyy', { locale: es })}
                        </TableCell>
                        <TableCell>
                            <div className='flex flex-col gap-1'>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="flex items-center gap-1.5 whitespace-nowrap text-xs">
                                        <Icon className="h-3.5 w-3.5" />
                                        <span>{categoryLabel}</span>
                                    </Badge>
                                </div>
                                <div className='text-muted-foreground text-xs md:text-sm truncate max-w-[200px] sm:max-w-xs'>
                                    {transaction.descriptionRaw || <span className='sm:hidden'>- Sin nota -</span>}
                                </div>
                                <div className='font-medium text-xs text-muted-foreground sm:hidden'>
                                     {format(new Date(transaction.date), 'dd MMMM yyyy', { locale: es })}
                                </div>
                            </div>
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${transaction.direction === 'credit' ? 'text-green-600' : ''}`}>
                            {transaction.direction === 'credit' ? '+' : '-'} {formatCurrency(transaction.amount)}
                        </TableCell>
                    </TableRow>
                )
            })}
        </TableBody>
        </Table>
    </div>
  );
}
