'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  BarChart2,
  LogOut,
  Wallet,
  Settings,
  Bell,
  Archive,
  Target,
  Scale,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Icons } from '../icons';
import { signOut } from 'firebase/auth';
import { initializeFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const { auth } = initializeFirebase();
    try {
      await signOut(auth);
      router.push('/login');
      toast({ title: 'Sesión cerrada', description: 'Has cerrado sesión exitosamente.' });
    } catch (error) {
      console.error('Error signing out: ', error);
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/dashboard'} tooltip={{ children: 'Dashboard' }}>
              <Link href="/dashboard"><Home /><span>Dashboard</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/transactions')} tooltip={{ children: 'Transacciones' }}>
              <Link href="/dashboard/transactions"><Wallet /><span>Transacciones</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/reconciliation')} tooltip={{ children: 'Importar Movimientos' }}>
              <Link href="/dashboard/reconciliation"><Scale /><span>Importar Movimientos</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/analysis')} tooltip={{ children: 'Análisis IA' }}>
              <Link href="/dashboard/analysis"><BarChart2 /><span>Análisis IA</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/budgets')} tooltip={{ children: 'Presupuestos' }}>
              <Link href="/dashboard/budgets"><Target /><span>Presupuestos</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/categories')} tooltip={{ children: 'Categorías' }}>
              <Link href="/dashboard/categories"><Archive /><span>Categorías</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/alerts')} tooltip={{ children: 'Alertas' }}>
              <Link href="/dashboard/alerts"><Bell /><span>Alertas</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/settings')} tooltip={{ children: 'Ajustes' }}>
              <Link href="/dashboard/settings"><Settings /><span>Ajustes</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
