

'use client';

import { useState, useCallback } from 'react';
import type { GenerateFinancialInsightsOutput } from '@/ai/types';
import { generateFinancialInsightsAction } from '@/app/actions';
import { usePeriod } from '@/context/period-context';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BrainCircuit, Loader2, FileWarning, TrendingDown, TrendingUp, Wallet, AlertTriangle, Lightbulb, BarChart3, Building2, Landmark, ShoppingCart, Activity } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Separator } from '../ui/separator';

export function AnalysisClient() {
    const { toast } = useToast();
    const { selectedPeriod, currentPeriodTransactions, loading: periodLoading } = usePeriod();

    const [loading, setLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<GenerateFinancialInsightsOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    const handleGenerateAnalysis = useCallback(async () => {
        if (currentPeriodTransactions.length < 1) {
            toast({
                variant: 'default',
                title: 'Datos insuficientes',
                description: 'Se necesita al menos 1 transacción en el período para generar un análisis.',
            });
            return;
        }

        setLoading(true);
        setAnalysisResult(null);
        setError(null);
        
        try {
             const aiInput = {
                transactions: currentPeriodTransactions.map(t => ({
                    ...t,
                    note: t.descriptionRaw,
                    date: new Date(t.date).toISOString().split('T')[0],
                })),
                periodDescription: format(new Date(selectedPeriod + '-02'), 'MMMM yyyy', {locale: es})
            };

            const result = await generateFinancialInsightsAction(aiInput);
            setAnalysisResult(result);
            toast({ title: 'Análisis completado', description: 'Se han generado nuevos insights para este período.' });

        } catch (err: any) {
            console.error("Error during analysis:", err);
            const errorMessage = 'No se pudo completar el análisis. ' + (err.message || 'Intenta de nuevo más tarde.');
            setError(errorMessage);
            toast({
                variant: 'destructive',
                title: 'Error de Análisis',
                description: errorMessage,
            });
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod, currentPeriodTransactions, toast]);

    const hasData = currentPeriodTransactions.length > 0;

    return (
        <div className="space-y-8">
            <Card className="shadow-lg border-primary/20">
                <CardHeader>
                    <CardTitle className="text-xl">Generar Análisis del Período</CardTitle>
                    <CardDescription>
                        Usa las transacciones guardadas en <strong>{format(new Date(selectedPeriod + '-02'), 'MMMM yyyy', {locale: es})}</strong> para que la IA genere un reporte detallado.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4">
                     <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">Transacciones disponibles para analizar:</p>
                        <p className="text-lg font-semibold">{currentPeriodTransactions.length}</p>
                    </div>
                    <Button onClick={handleGenerateAnalysis} disabled={loading || !hasData} size="lg" className="w-full sm:w-auto text-base">
                        {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <BrainCircuit className="mr-2 h-5 w-5" />}
                        {loading ? 'Generando...' : 'Generar Análisis con IA'}
                    </Button>
                </CardContent>
            </Card>

            {periodLoading ? <AnalysisSkeleton /> : (
                <>
                    {!hasData ? (
                         <Card>
                            <CardContent className="p-8 text-center">
                                <FileWarning className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                                <h2 className="text-lg font-medium text-foreground">No hay transacciones en este período.</h2>
                                <p className="text-muted-foreground mb-4">Para generar un análisis, primero necesitas guardar movimientos.</p>
                                <Button asChild>
                                    <Link href="/dashboard/reconciliation">Importar Movimientos</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ) : loading ? (
                        <AnalysisSkeleton />
                    ) : error ? (
                         <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : analysisResult ? (
                        <div className="space-y-8">
                            <Card className="bg-muted/20 border-l-4 border-primary">
                                <CardHeader>
                                    <CardTitle className="text-2xl font-headline">{analysisResult.titulo_general}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-base text-muted-foreground">{analysisResult.resumen_ejecutivo}</p>
                                </CardContent>
                            </Card>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <StatItem icon={TrendingUp} label="Ingresos Totales" value={formatCurrency(analysisResult.metricas_generales.ingresos_totales)} color="text-positive" />
                                <StatItem icon={TrendingDown} label="Gastos Totales" value={formatCurrency(analysisResult.metricas_generales.gastos_totales)} color="text-negative" />
                                <StatItem icon={Wallet} label="Saldo Neto" value={formatCurrency(analysisResult.metricas_generales.saldo_neto)} color={analysisResult.metricas_generales.saldo_neto >= 0 ? 'text-foreground' : 'text-negative'} />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                            <Landmark className="h-5 w-5" />
                                            Análisis de Ingresos
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <InfoList items={analysisResult.analisis_ingresos.insights} />
                                        <Separator />
                                        <ListCard title="Principales Fuentes de Ingreso" items={analysisResult.analisis_ingresos.top_fuentes} renderItem={fuente => (
                                            <>
                                                <span className="font-medium truncate max-w-[150px]">{fuente.nombre}</span>
                                                <span className="text-sm text-muted-foreground">{fuente.veces} {fuente.veces > 1 ? 'veces' : 'vez'}</span>
                                                <span className="font-semibold">{formatCurrency(fuente.monto)}</span>
                                            </>
                                        )} />
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                            <ShoppingCart className="h-5 w-5" />
                                            Análisis de Gastos
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <InfoList items={analysisResult.analisis_gastos.insights} />
                                        <Separator />
                                        <ListCard title="Top Categorías de Gasto" items={analysisResult.analisis_gastos.top_categorias} renderItem={cat => (
                                            <>
                                                <span className="font-medium">{cat.nombre}</span>
                                                <span className="font-semibold">{formatCurrency(cat.monto)}</span>
                                            </>
                                        )} />
                                        <Separator />
                                        <ListCard title="Top Comercios de Gasto" items={analysisResult.analisis_gastos.top_comercios} renderItem={merch => (
                                            <>
                                                <span className="font-medium truncate max-w-[150px]">{merch.nombre}</span>
                                                <span className="text-sm text-muted-foreground">{merch.veces} {merch.veces > 1 ? 'veces' : 'vez'}</span>
                                                <span className="font-semibold">{formatCurrency(merch.monto)}</span>
                                            </>
                                        )} />
                                    </CardContent>
                                </Card>
                            </div>
                            
                            <InfoCard icon={AlertTriangle} title="Alertas y Riesgos" items={analysisResult.alertas_riesgos} color="text-orange-500" />
                            <InfoCard icon={Activity} title="Recomendaciones Accionables" items={analysisResult.recomendaciones_accionables} color="text-blue-500"/>
                        </div>
                    ) : (
                         <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
                            <BrainCircuit className="mx-auto h-12 w-12 text-primary/50 mb-4" />
                            <h2 className="text-lg font-semibold text-foreground">Listo para analizar</h2>
                            <p className="text-sm max-w-md mx-auto mt-2">
                                Haz clic en "Generar Análisis con IA" para obtener un reporte detallado de tus finanzas para este período.
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

const StatItem = ({ icon: Icon, label, value, color }: { icon: React.ElementType, label: string, value: string, color?: string }) => (
    <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <Icon className={`h-5 w-5 ${color || 'text-primary'}`} />
        </div>
        <div>
            <p className={`text-2xl font-bold ${color || 'text-foreground'}`}>{value}</p>
        </div>
    </Card>
);

const InfoList = ({ items }: { items: string[] }) => (
    items && items.length > 0 ? (
        <ul className="space-y-2 list-disc list-inside text-muted-foreground text-sm">
            {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
    ) : (
        <p className="text-sm text-muted-foreground">No se generaron insights específicos.</p>
    )
);

const InfoCard = ({ icon: Icon, title, items, color }: { icon: React.ElementType, title: string, items: string[], color?: string }) => (
    <Card>
        <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${color || 'text-foreground'}`}>
                <Icon className="h-5 w-5" />
                {title}
            </CardTitle>
        </CardHeader>
        <CardContent>
            {items && items.length > 0 ? (
                <ul className="space-y-3 list-disc list-inside text-muted-foreground">
                    {items.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground">No se detectaron {title.toLowerCase()} para este período.</p>
            )}
        </CardContent>
    </Card>
);

const ListCard = <T,>({ title, items, renderItem }: { title: string, items: T[], renderItem: (item: T) => React.ReactNode }) => (
    <div>
        <h4 className="font-semibold mb-3 text-sm">{title}</h4>
        {items && items.length > 0 ? (
                <ul className="space-y-3">
                {items.map((item, i) => (
                    <li key={i} className="flex justify-between items-center text-sm">
                        {renderItem(item)}
                    </li>
                ))}
            </ul>
        ) : (
                <p className="text-sm text-muted-foreground">No hay datos disponibles.</p>
        )}
    </div>
);

const AnalysisSkeleton = () => (
    <div className="space-y-8">
        <Card>
            <CardHeader><Skeleton className="h-8 w-3/4 rounded-md" /></CardHeader>
            <CardContent><Skeleton className="h-5 w-full rounded-md" /><Skeleton className="h-5 w-2/3 mt-2 rounded-md" /></CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
        </div>
    </div>
);
