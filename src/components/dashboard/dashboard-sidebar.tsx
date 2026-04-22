'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  TrendingUp,
  LogOut,
  Wallet,
  Settings,
  Bell,
  Target,
  Tag,
  Upload,
  LayoutDashboard,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Icons } from '../icons';
import { signOut } from 'firebase/auth';
import { initializeFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';

const NAV_MAIN = [
  { href: '/dashboard',                 label: 'Inicio',                    icon: Home,          exact: true  },
  { href: '/dashboard/transactions',    label: 'Movimientos',               icon: Wallet,        exact: false },
  { href: '/dashboard/reconciliation',  label: 'Importar Estado de Cuenta', icon: Upload,        exact: false },
  { href: '/dashboard/analysis',        label: 'Análisis',                  icon: TrendingUp,    exact: false },
  { href: '/dashboard/budgets',         label: 'Presupuestos',              icon: Target,        exact: false },
];

const NAV_CONFIG = [
  { href: '/dashboard/categories', label: 'Categorías', icon: Tag,      exact: false },
  { href: '/dashboard/alerts',     label: 'Alertas',    icon: Bell,     exact: false },
  { href: '/dashboard/settings',   label: 'Ajustes',    icon: Settings, exact: false },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { toast } = useToast();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const handleSignOut = async () => {
    const { auth } = initializeFirebase();
    try {
      await signOut(auth);
      router.push('/login');
      toast({ title: 'Sesión cerrada', description: 'Has cerrado sesión exitosamente.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cerrar la sesión.' });
    }
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2">
          <Icons.logo className="h-7 w-7 text-primary" />
          <span className="font-headline text-lg font-semibold text-foreground">Finanzas Claras</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* ── Mis Finanzas ─────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel>Mis Finanzas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_MAIN.map(({ href, label, icon: Icon, exact }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(href, exact)}
                    tooltip={{ children: label }}
                  >
                    <Link href={href}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* ── Configuración ────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel>Configuración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_CONFIG.map(({ href, label, icon: Icon, exact }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(href, exact)}
                    tooltip={{ children: label }}
                  >
                    <Link href={href}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Button onClick={handleSignOut} variant="ghost" className="w-full justify-start gap-2">
          <LogOut className="h-4 w-4" />
          <span>Cerrar Sesión</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
