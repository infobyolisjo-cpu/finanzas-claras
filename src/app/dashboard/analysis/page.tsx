
'use client';

import { ReportClient } from '@/components/reports/report-client';

export default function AnalysisPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">Reporte Financiero</h1>
                <p className="text-muted-foreground">Estado de resultados, flujo de caja y desglose de gastos del período seleccionado.</p>
            </div>
            <ReportClient />
        </div>
    );
}
