'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, PlusCircle } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { TRANSACTION_CATEGORIES } from '@/lib/constants';
import { useAuth } from '@/context/auth-context';
import { firestore } from '@/firebase'; // Use the singleton instance
import { createTransactionHash } from '@/lib/firestore';

const transactionFormSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer'], { required_error: 'Debes seleccionar un tipo.' }),
  amount: z.coerce.number().positive({ message: 'El monto debe ser positivo.' }),
  date: z.date({ required_error: 'Debes seleccionar una fecha.' }),
  category: z.string({ required_error: 'Debes seleccionar una categoría.' }),
  note: z.string().max(100, 'La nota no puede tener más de 100 caracteres.').optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer']).optional(),
  isRecurring: z.boolean().default(false),
  frequency: z.enum(['weekly', 'monthly']).optional(),
}).refine(data => {
    if (data.isRecurring && !data.frequency) {
      return false;
    }
    return true;
}, {
    message: 'Debes seleccionar una frecuencia para una transacción recurrente.',
    path: ['frequency'],
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export function AddTransactionDialog({ onTransactionAdded }: { onTransactionAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      type: 'expense',
      date: new Date(),
      note: '',
      isRecurring: false,
    },
  });

  const isRecurring = form.watch('isRecurring');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(data: TransactionFormValues) {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Error de autenticación",
            description: "Debes iniciar sesión para agregar una transacción.",
        });
        return;
    }

    setIsSubmitting(true);
    try {
        const amountWithSign = data.type === 'expense' ? -data.amount : data.amount;
        const hashString = `${data.date.toISOString().split('T')[0]}|${amountWithSign}|${data.note || ''}`;
        const transactionId = await createTransactionHash(hashString);
        
        const docRef = doc(firestore, 'users', user.uid, 'transactions', transactionId);

        const dataToSave: any = {
            userId: user.uid,
            importIds: [],
            date: data.date,
            period: format(data.date, 'yyyy-MM'),
            descriptionRaw: data.note || '',
            amount: data.amount,
            direction: data.type === 'expense' ? 'debit' : 'credit',
            type: data.type,
            isTransfer: data.type === 'transfer',
            category: data.type === 'transfer' ? 'transfer' : data.category,
            source: 'manual',
            paymentMethod: data.paymentMethod,
            isRecurring: data.isRecurring,
            frequency: data.isRecurring ? data.frequency : undefined,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        await setDoc(docRef, dataToSave, { merge: true });
        
        toast({
            title: "¡Éxito!",
            description: "La transacción ha sido agregada.",
        });
        onTransactionAdded();
        setOpen(false);
        form.reset({type: 'expense', date: new Date(), note: '', isRecurring: false});
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Error",
            description: `No se pudo agregar la transacción. ${error.message}`,
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  const transactionType = form.watch('type');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Añadir Transacción
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Transacción</DialogTitle>
          <DialogDescription>Añade un nuevo ingreso o gasto a tu cuenta.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Tipo de Transacción</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="expense" />
                        </FormControl>
                        <FormLabel className="font-normal">Gasto</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="income" />
                        </FormControl>
                        <FormLabel className="font-normal">Ingreso</FormLabel>
                      </FormItem>
                       <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="transfer" />
                        </FormControl>
                        <FormLabel className="font-normal">Transferencia</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0.00" {...field} step="0.01" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={transactionType === 'transfer'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TRANSACTION_CATEGORIES.filter(c => c.type === transactionType || c.type === 'both').map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {transactionType === 'transfer' && <FormDescription>Las transferencias tienen su propia categoría.</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={'outline'}
                            className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                          >
                            {field.value ? (
                              format(field.value, 'dd MMMM, yyyy', { locale: es })
                            ) : (
                              <span>Elige una fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date() || date < new Date('2000-01-01')}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método de pago</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un método" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="card">Tarjeta</SelectItem>
                        <SelectItem value="cash">Efectivo</SelectItem>
                        <SelectItem value="transfer">Transferencia</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Ej: Café con amigos" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isRecurring"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Transacción Recurrente</FormLabel>
                    <FormDescription>
                      Marcar si este es un gasto o ingreso regular.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            {isRecurring && (
                 <FormField
                 control={form.control}
                 name="frequency"
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel>Frecuencia</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                       <FormControl>
                         <SelectTrigger>
                           <SelectValue placeholder="Selecciona la frecuencia" />
                         </SelectTrigger>
                       </FormControl>
                       <SelectContent>
                         <SelectItem value="weekly">Semanal</SelectItem>
                         <SelectItem value="monthly">Mensual</SelectItem>
                       </SelectContent>
                     </Select>
                     <FormMessage />
                   </FormItem>
                 )}
               />
            )}

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? 'Guardando...' : 'Guardar Transacción'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
