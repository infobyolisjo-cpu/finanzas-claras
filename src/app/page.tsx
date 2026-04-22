import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { FinancialAnalyzer } from '@/components/financial-analyzer';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-bj-canvas">

      {/* Header */}
      <header className="border-b border-border/60 bg-bj-canvas px-4 py-4 md:px-6">
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-foreground">
            <Icons.logo className="h-5 w-5" />
            <span className="font-display text-[17px] font-medium tracking-tight">Finanzas Claras</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button variant="brand" size="sm" asChild>
              <Link href="/signup">Comenzar gratis</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">

        {/* Hero */}
        <section className="container mx-auto px-4 pt-20 pb-12 md:pt-28 md:pb-16 text-center">
          <p className="text-eyebrow text-bj-text-secondary mb-5 tracking-eyebrow">
            Finanzas personales
          </p>
          <h1 className="font-display text-[36px] md:text-[52px] lg:text-[60px] font-medium tracking-tight leading-[1.08] text-foreground max-w-3xl mx-auto mb-6">
            Tus finanzas, claras y bajo control.
          </h1>
          <p className="text-[17px] leading-relaxed text-bj-text-secondary max-w-xl mx-auto mb-10">
            Visualiza tus ingresos, controla tus gastos y toma mejores decisiones cada mes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="brand" size="lg" asChild>
              <Link href="/signup">Ver mi dinero claro</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/login">Ya tengo una cuenta</Link>
            </Button>
          </div>
        </section>

        {/* Analizador funcional */}
        <FinancialAnalyzer />

        {/* Features */}
        <section className="bg-bj-sidebar py-14 md:py-16">
          <div className="container mx-auto px-4 text-center">
            <p className="text-eyebrow text-bj-text-on-dark/60 mb-4 tracking-eyebrow">
              Funcionalidades
            </p>
            <h2 className="font-display text-[26px] md:text-[32px] font-medium text-bj-text-on-dark mb-3 leading-tight">
              Todo lo que necesitas en un solo lugar
            </h2>
            <p className="text-bj-text-on-dark/70 mb-12 max-w-xl mx-auto text-[15px] leading-relaxed">
              Diseñada para personas reales que quieren orden financiero sin complicarse.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-bj-text-on-dark/10 border border-bj-text-on-dark/10 rounded-md overflow-hidden max-w-4xl mx-auto">
              {[
                {
                  title: 'Entiende tu dinero',
                  desc: 'Ingresos, gastos y saldo en tiempo real.',
                },
                {
                  title: 'Analiza sin estrés',
                  desc: 'Análisis automático de tu estado de cuenta. Tendencias y recomendaciones claras.',
                },
                {
                  title: 'Detecta errores',
                  desc: 'Compara movimientos con tu banco. Detecta cargos duplicados o faltantes.',
                },
              ].map((f) => (
                <div key={f.title} className="bg-bj-sidebar px-8 py-8 text-left">
                  <h3 className="font-body text-[15px] font-medium text-bj-text-on-dark mb-2">{f.title}</h3>
                  <p className="text-bj-text-on-dark/60 text-[13px] leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-[11px] text-bj-text-tertiary max-w-2xl mx-auto leading-relaxed">
            Finanzas Claras es una herramienta educativa de apoyo para la organización financiera personal.
            No sustituye asesoría contable, fiscal ni financiera profesional.
          </p>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-6 bg-bj-canvas">
        <div className="container mx-auto px-4 text-center text-[12px] text-bj-text-tertiary">
          &copy; {new Date().getFullYear()} Finanzas Claras · byolisjo.com
        </div>
      </footer>

    </div>
  );
}
