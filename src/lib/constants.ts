'use client';

import {
  Landmark,
  PiggyBank,
  Utensils,
  Car,
  Home,
  Shirt,
  HeartPulse,
  Film,
  GraduationCap,
  Plane,
  Gift,
  MoreHorizontal,
  Briefcase,
  Receipt,
  ShoppingBag,
  Heart,
  Train,
  BookOpen,
  ArrowRightLeft,
  ShieldBan,
  Fuel,
  Route,
  type LucideIcon,
} from 'lucide-react';

export const TRANSACTION_CATEGORIES: {
  value: string;
  label: string;
  icon: LucideIcon;
  type: 'income' | 'expense' | 'both';
}[] = [
  // Ingresos
  { value: 'salary', label: 'Salario', icon: Briefcase, type: 'income' },
  { value: 'investments', label: 'Inversiones', icon: Landmark, type: 'income' },
  { value: 'freelance', label: 'Freelance', icon: PiggyBank, type: 'income' },
  { value: 'gifts_received', label: 'Regalos Recibidos', icon: Gift, type: 'income' },

  // Gastos
  { value: 'food', label: 'Comida', icon: Utensils, type: 'expense' },
  { value: 'transport', label: 'Transporte', icon: Car, type: 'expense' },
  { value: 'housing', label: 'Vivienda', icon: Home, type: 'expense' },
  { value: 'bills', label: 'Facturas y Servicios', icon: Receipt, type: 'expense' },
  { value: 'shopping', label: 'Compras', icon: ShoppingBag, type: 'expense' },
  { value: 'clothing', label: 'Ropa', icon: Shirt, type: 'expense' },
  { value: 'health', label: 'Salud', icon: HeartPulse, type: 'expense' },
  { value: 'entertainment', label: 'Entretenimiento', icon: Film, type: 'expense' },
  { value: 'education', label: 'Educación', icon: GraduationCap, type: 'expense' },
  { value: 'travel', label: 'Viajes', icon: Plane, type: 'expense' },
  { value: 'subscriptions', label: 'Suscripciones', icon: Train, type: 'expense' },
  { value: 'personal_care', label: 'Cuidado Personal', icon: Heart, type: 'expense' },
  { value: 'gifts_given', label: 'Regalos Hechos', icon: Gift, type: 'expense' },
  { value: 'bank_fees', label: 'Comisiones bancarias', icon: ShieldBan, type: 'expense' },
  { value: 'fuel', label: 'Combustible', icon: Fuel, type: 'expense' },
  { value: 'tolls', label: 'Peajes y autopistas', icon: Route, type: 'expense' },
  
  // Both (can be income or expense, but special cased)
  { value: 'transfer', label: 'Transferencia', icon: ArrowRightLeft, type: 'both' },
  { value: 'other', label: 'Otro', icon: MoreHorizontal, type: 'both' },
];

export const CATEGORY_ICONS: { [key: string]: LucideIcon } = TRANSACTION_CATEGORIES.reduce(
  (acc, category) => {
    acc[category.value] = category.icon;
    return acc;
  },
  {} as { [key: string]: LucideIcon }
);
