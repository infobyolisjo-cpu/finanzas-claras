'use client';

export function NoDataPlaceholder() {
    return (
        <div className="h-[350px] w-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
                <p className="font-medium">No hay suficientes datos.</p>
                <p className="text-sm">Registra transacciones para ver los gráficos.</p>
            </div>
        </div>
    );
}
