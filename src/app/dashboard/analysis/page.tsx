
'use client';

import { AnalysisClient } from "@/components/analysis/analysis-client";

export default function AnalysisPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Análisis con IA</h1>
                    <p className="text-muted-foreground">Tu asistente financiero personal para optimizar tus gastos, basado en tus transacciones guardadas.</p>
                </div>
            </div>
            
            <AnalysisClient />

        </div>
    );
}
