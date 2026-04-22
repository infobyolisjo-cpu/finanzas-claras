import type { BusinessType } from '@/lib/types';

export type BusinessProfile = {
  id: string;
  businessType: BusinessType;
  hasEmployees: boolean;
  name: string;
  description: string;
  emoji: string;
  incomeCategories: string[];
  expenseCategories: string[];
  tips: string[];
};

export const BUSINESS_PROFILES: BusinessProfile[] = [
  {
    id: 'servicios-solo',
    businessType: 'servicios',
    hasEmployees: false,
    name: 'Servicios — Independiente',
    description: 'Diseño, consultoría, clases, asesorías, freelance sin equipo.',
    emoji: '💼',
    incomeCategories: ['freelance', 'salary', 'transfer'],
    expenseCategories: ['subscriptions', 'education', 'bills', 'transport', 'personal_care', 'other'],
    tips: [
      'Separa los ingresos por cliente para ver de dónde viene más dinero.',
      'Marca como "personal" los gastos que no son del negocio.',
      'Las suscripciones de trabajo (Canva, software, etc.) son gasto deducible.',
    ],
  },
  {
    id: 'servicios-equipo',
    businessType: 'servicios',
    hasEmployees: true,
    name: 'Servicios — Con equipo',
    description: 'Agencia, estudio, despacho o consultoría con empleados o colaboradores.',
    emoji: '🏢',
    incomeCategories: ['freelance', 'salary', 'investments'],
    expenseCategories: ['bills', 'subscriptions', 'transport', 'education', 'other'],
    tips: [
      'Registra los pagos a colaboradores como gasto de nómina.',
      'Monitorea el flujo mensual: ingresos de clientes vs. pagos de equipo.',
      'Usa categoría "Transferencias" para pagos internos entre cuentas.',
    ],
  },
  {
    id: 'productos-solo',
    businessType: 'productos',
    hasEmployees: false,
    name: 'Productos — Independiente',
    description: 'Venta de artículos, artesanías, ropa, comida o cualquier producto físico.',
    emoji: '🛍️',
    incomeCategories: ['freelance', 'salary', 'transfer'],
    expenseCategories: ['shopping', 'transport', 'bills', 'fuel', 'tolls', 'other'],
    tips: [
      'Separa tus compras de inventario de tus gastos personales.',
      'El transporte para entregas es gasto de negocio.',
      'Registra cada venta como ingreso aunque sea en efectivo.',
    ],
  },
  {
    id: 'productos-equipo',
    businessType: 'productos',
    hasEmployees: true,
    name: 'Productos — Con equipo',
    description: 'Tienda física, e-commerce o manufactura con empleados o ayudantes.',
    emoji: '🏪',
    incomeCategories: ['freelance', 'salary', 'investments'],
    expenseCategories: ['shopping', 'transport', 'bills', 'fuel', 'tolls', 'other'],
    tips: [
      'Controla el inventario separado de tu flujo de efectivo.',
      'Los salarios de equipo son tu gasto más predecible — presupuéstalos primero.',
      'Compara ingresos vs. gastos mes a mes para detectar temporadas bajas.',
    ],
  },
  {
    id: 'mixto',
    businessType: 'mixto',
    hasEmployees: false,
    name: 'Negocio mixto',
    description: 'Combinas servicios con venta de productos, con o sin equipo.',
    emoji: '⚡',
    incomeCategories: ['freelance', 'salary', 'transfer', 'investments'],
    expenseCategories: ['shopping', 'transport', 'bills', 'subscriptions', 'education', 'fuel', 'other'],
    tips: [
      'Diferencia el ingreso por servicios del ingreso por ventas de productos.',
      'Identifica cuál línea es más rentable para enfocar tu energía.',
      'Mantén una categoría "Inversión en negocio" para compras que generan más ventas.',
    ],
  },
];

export function getProfileById(id: string): BusinessProfile | undefined {
  return BUSINESS_PROFILES.find((p) => p.id === id);
}

export function getProfileByType(businessType: BusinessType, hasEmployees: boolean): BusinessProfile | undefined {
  return BUSINESS_PROFILES.find(
    (p) => p.businessType === businessType && (businessType === 'mixto' || p.hasEmployees === hasEmployees)
  );
}

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  productos: 'Productos',
  servicios: 'Servicios',
  mixto: 'Mixto',
};
