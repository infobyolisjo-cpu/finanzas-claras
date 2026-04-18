'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/context/auth-context';
import { usePeriod } from '@/context/period-context';
import { initializeFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function DashboardHeader() {
  const { user } = useAuth();
  const { periodOptions, selectedPeriod, setSelectedPeriod } = usePeriod();
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

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <SidebarTrigger className="md:hidden" />
        
        {periodOptions.length > 0 && (
            <div className="flex-1">
                <Select onValueChange={setSelectedPeriod} value={selectedPeriod}>
                    <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder="Seleccionar período" />
                    </SelectTrigger>
                    <SelectContent>
                        {periodOptions.map(option => (
                            <SelectItem key={option} value={option}>{format(new Date(option + '-02'), 'MMMM yyyy', {locale: es})}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        )}
        
        <div className="flex-1 md:hidden" />

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || 'Usuario'} />
                <AvatarFallback>{getInitials(user?.displayName || user?.email)}</AvatarFallback>
                </Avatar>
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                    {user?.displayName || 'Usuario'}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                </p>
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
            </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    </header>
  );
}
