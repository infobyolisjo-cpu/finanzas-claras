'use client';

import { useState, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { BookOpen, Calendar, ArrowRightLeft, FolderSync, AlertTriangle, PieChart, Banknote, Trash2, Loader2, FileArchive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePeriod } from '@/context/period-context';
import { deleteImportAndTransactionsAction, cleanupDuplicateTransactionsAction } from '@/app/actions';
import { getUserImports } from '@/lib/firestore';
import type { Import } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/context/auth-context';


function ImportsManager() {
    const { toast } = useToast();
    const { user } = useAuth();
    const { refreshTransactions } = usePeriod();
    const [imports, setImports] = useState<Import[]>([]);
    const [loadingImports, setLoadingImports] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchImports = async () => {
        if (!user) return;
        setLoadingImports(true);
        try {
            const userImports = await getUserImports(user.uid);
            setImports(userImports);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las importaciones.' });
        } finally {
            setLoadingImports(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchImports();
        }
    }, [user]);

    const handleDeleteImport = async (importId: string) => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes iniciar sesión para eliminar.'});
            return;
        }
        setDeletingId(importId);
        try {
            // Force token refresh before making a critical server action call
            await user.getIdToken(true);
            const result = await deleteImportAndTransactionsAction(importId);
            
            if (result.success) {
                toast({
                    title: 'Importación Eliminada',
                    description: `Se eliminaron ${result.deletedCount} transacciones asociadas.`,
                });
                refreshTransactions(); // Refresh global data
                fetchImports(); // Refresh the list of imports
            } else {
                 if (result.error?.includes("Authentication required")) {
                    toast({
                        variant: "destructive",
                        title: "No se pudo eliminar la importación.",
                        description: "Tu sesión puede haber expirado. Por favor, inicia sesión de nuevo.",
                    });
                } else {
                    throw new Error(result.error || "Ocurrió un error desconocido.");
                }
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error al Eliminar',
                description: `No se pudo eliminar la importación. ${error.message}`,
            });
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <FileArchive className="h-6 w-6" />
                    <CardTitle className="text-xl">Gestionar Importaciones</CardTitle>
                </div>
                <CardDescription>
                    Elimina estados de cuenta completos junto con todas sus transacciones asociadas. Esta acción es irreversible.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loadingImports ? (
                    <p>Cargando importaciones...</p>
                ) : imports.length > 0 ? (
                    <ul className="space-y-3">
                        {imports.map((imp) => (
                            <li key={imp.id} className="flex flex-col sm:flex-row items-center justify-between p-3 border rounded-lg bg-muted/20">
                                <div className='flex-1 mb-2 sm:mb-0'>
                                    <p className="font-semibold">{imp.fileName}</p>
                                    <p className="text-sm text-muted-foreground">
                                        Importado el {format(new Date(imp.createdAt), 'dd MMMM, yyyy', { locale: es })} • {imp.transactionCount} transacciones
                                    </p>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm" disabled={deletingId === imp.id}>
                                            {deletingId === imp.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                            {deletingId === imp.id ? 'Eliminando...' : 'Eliminar'}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Confirmas la eliminación?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esto eliminará permanentemente la importación del archivo "{imp.fileName}" y sus <strong>{imp.transactionCount} transacciones asociadas</strong>. Esta acción no se puede deshacer.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteImport(imp.id)}>Sí, eliminar todo</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground text-center">No hay importaciones registradas.</p>
                )}
            </CardContent>
        </Card>
    );
}


export default function SettingsPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const { refreshTransactions } = usePeriod();
    const [isCleaning, setIsCleaning] = useState(false);

    const sections = [
        {
            title: "1. Origen de los datos",
            icon: <FolderSync className="h-5 w-5 text-[#515193]" />,
            content: "Finanzas Claras trabaja a partir de los estados de cuenta que cargas. Todas las transacciones se clasifican automáticamente por fecha, tipo y categoría."
        },
        {
            title: "2. Organización por mes",
            icon: <Calendar className="h-5 w-5 text-[#515193]" />,
            content: (
                <>
                    <p>Cada movimiento se agrupa por mes calendario.</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
                        <li>El <strong>Dashboard</strong> muestra únicamente el mes seleccionado.</li>
                        <li>La sección <strong>Transacciones</strong> te permite ver y comparar meses anteriores.</li>
                    </ul>
                </>
            )
        },
        {
            title: "3. Ingresos y gastos",
            icon: <ArrowRightLeft className="h-5 w-5 text-[#515193]" />,
            content: (
                 <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li><strong>Ingresos</strong>: depósitos, transferencias recibidas, pagos (ej. Uber, Zelle, efectivo).</li>
                    <li><strong>Gastos</strong>: compras, pagos de servicios, suscripciones y transferencias enviadas.</li>
                </ul>
            )
        },
        {
            title: "4. Categorías",
            icon: <PieChart className="h-5 w-5 text-[#515193]" />,
            content: "Las transacciones se asignan a categorías como Transporte, Comida, Compras, Servicios, etc. Esto permite ver el desglose y detectar en qué se concentra tu gasto."
        },
        {
            title: "5. Importación de Movimientos",
            icon: <Banknote className="h-5 w-5 text-[#515193]" />,
            content: "La importación compara lo que viene del banco con lo que ya está guardado en tu historial, evitando duplicados y asegurando totales correctos."
        },
        {
            title: "6. Alertas y análisis",
            icon: <AlertTriangle className="h-5 w-5 text-[#515193]" />,
            content: "Cuando los gastos superan los ingresos del mes, el sistema genera una alerta para ayudarte a tomar decisiones a tiempo."
        }
    ];

    const handleCleanup = async () => {
        setIsCleaning(true);
        try {
            if (!user) throw new Error("Authentication required.");
            // Force token refresh before making a critical server action call
            await user.getIdToken(true);
            
            const result = await cleanupDuplicateTransactionsAction();
            if (result.success) {
                toast({
                    title: "Limpieza Completada",
                    description: `${result.duplicatesDeleted} transacciones duplicadas eliminadas. ${result.totalChecked} revisadas.`,
                });
                refreshTransactions(); // This will refetch data globally
            } else {
                throw new Error(result.error || "Un error desconocido ocurrió.");
            }
        } catch (error: any) {
             if (error.message?.includes("Authentication required")) {
                toast({
                    variant: "destructive",
                    title: "No se pudo realizar la limpieza.",
                    description: "Tu sesión puede haber expirado. Por favor, inicia sesión de nuevo.",
                });
            } else {
                toast({
                    variant: 'destructive',
                    title: "Error en la Limpieza",
                    description: `No se pudieron eliminar los duplicados. ${error.message}`,
                });
            }
        } finally {
            setIsCleaning(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Ajustes y Ayuda</h1>
                    <p className="text-muted-foreground">Configura tus preferencias y aprende cómo funciona la app.</p>
                </div>
            </div>

            <ImportsManager />

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                         <BookOpen className="h-6 w-6" />
                        <CardTitle className="text-xl">¿Cómo funciona Finanzas Claras?</CardTitle>
                    </div>
                    <CardDescription>
                        Esta sección te ayuda a entender cómo la aplicación organiza y analiza tu información financiera.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full" defaultValue="item-0">
                        {sections.map((section, index) => (
                            <AccordionItem value={`item-${index}`} key={index}>
                                <AccordionTrigger className="text-base hover:no-underline">
                                    <div className="flex items-center gap-3">
                                        {section.icon}
                                        <span className="font-semibold">{section.title}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="text-base text-muted-foreground pl-11">
                                    {typeof section.content === 'string' ? <p>{section.content}</p> : section.content}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                     <div className="pt-6 pl-11 text-sm text-muted-foreground">
                        <p>Esta configuración no modifica tus datos bancarios originales; solo define cómo se muestran y analizan dentro de la aplicación.</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                         <Trash2 className="h-6 w-6" />
                        <CardTitle className="text-xl">Mantenimiento de Datos</CardTitle>
                    </div>
                    <CardDescription>
                        Herramientas para mantener la consistencia y limpieza de tus datos financieros.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row items-center justify-between p-4 border rounded-lg">
                        <div>
                            <h4 className="font-semibold">Limpiar Transacciones Duplicadas</h4>
                            <p className="text-sm text-muted-foreground">Elimina registros repetidos que pueden haberse creado al importar archivos varias veces.</p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="mt-4 sm:mt-0" disabled={isCleaning}>
                                    {isCleaning ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="mr-2 h-4 w-4" />
                                    )}
                                    {isCleaning ? 'Limpiando...' : 'Limpiar Duplicados'}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción es irreversible. Se buscarán y eliminarán permanentemente todas las
                                    transacciones duplicadas en tu cuenta, conservando solo un registro único para cada una.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleCleanup}>Sí, eliminar duplicados</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
