
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Icons } from '@/components/icons';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="p-4 md:px-6">
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-foreground">
            <Icons.logo className="h-6 w-6 text-foreground" />
            <span className="font-headline">Finanzas Claras</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Iniciar Sesión</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Regístrate Gratis</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto flex flex-col items-center justify-center text-center py-20 md:py-28">
          <div className="space-y-6 max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-headline font-extrabold tracking-tight text-foreground">
              Tus finanzas, claras y bajo control.
            </h1>
            <p className="text-lg md:text-xl text-foreground">
              Visualiza tus ingresos, controla tus gastos y toma mejores decisiones cada mes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href="/signup">Ver mi dinero claro</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Ya tengo una cuenta</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="bg-[#515193] py-10 md:py-12">
          <div className="container mx-auto text-center">
            <h2 className="text-2xl font-headline font-bold mb-2 text-white">
              Todo lo que necesitas para entender tu dinero, en un solo lugar
            </h2>
            <p className="text-white mb-8 md:mb-10 max-w-2xl mx-auto">
              Diseñada para personas reales que quieren orden financiero sin complicarse.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 max-w-5xl mx-auto">
              <div className="p-4 text-center">
                <h3 className="text-xl font-semibold mb-2 whitespace-nowrap text-white">Entiende tu dinero</h3>
                <p className="text-white text-sm leading-relaxed">Ingresos, gastos y saldo en tiempo real.</p>
              </div>
              <div className="p-4 text-center">
                <h3 className="text-xl font-semibold mb-2 whitespace-nowrap text-white">Analiza sin estrés</h3>
                <p className="text-white text-sm leading-relaxed">Análisis automático de tu estado de cuenta. Tendencias, alertas y recomendaciones claras.</p>
              </div>
              <div className="p-4 text-center">
                <h3 className="text-xl font-semibold mb-2 whitespace-nowrap text-white">Detecta errores</h3>
                <p className="text-white text-sm leading-relaxed">Compara tus movimientos con tu banco. Detecta errores, cargos duplicados o faltantes.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="container mx-auto py-8 text-center">
          <p className="text-xs text-foreground max-w-3xl mx-auto">
            Finanzas Claras es una aplicación educativa de apoyo para la organización financiera personal. No sustituye asesoría contable, fiscal ni financiera profesional.
          </p>
        </div>

      </main>

      <footer className="py-6 bg-background">
        <div className="container mx-auto text-center text-foreground text-sm">
          &copy; {new Date().getFullYear()} Finanzas Claras. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
