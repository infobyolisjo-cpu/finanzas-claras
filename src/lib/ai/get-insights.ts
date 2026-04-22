import { callGemini } from './providers/gemini';
import { callOpenAI }  from './providers/openai';

// ── Input / output types ──────────────────────────────────────────────────────

/** Compact summary sent to AI — never raw PDF text. */
export type InsightInput = {
  bank:              string | null;
  period:            string | null;
  income:            number;
  expenses:          number;
  fees:              number;
  net:               number;
  transaction_count: number;
  top_descriptions:  string[];
};

export type AiInsights = {
  headline:        string;
  summary:         string;
  insights:        string[];
  risks:           string[];
  recommendations: string[];
};

export type InsightResult =
  | { ok: true;  provider: 'gemini' | 'openai'; data: AiInsights }
  | { ok: false; provider: 'none';              error: string    };

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(input: InsightInput): string {
  const mxn = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
  const savingsRate = input.income > 0 ? ((input.net / input.income) * 100).toFixed(1) : '0';

  const summary = {
    banco:            input.bank ?? 'No identificado',
    período:          input.period ?? 'No identificado',
    ingresos:         mxn(input.income),
    gastos:           mxn(input.expenses),
    comisiones:       mxn(input.fees),
    saldo_neto:       mxn(input.net),
    tasa_de_ahorro:   `${savingsRate}%`,
    movimientos:      input.transaction_count,
    principales:      input.top_descriptions.slice(0, 6),
  };

  return `Eres un asesor financiero práctico y directo.

Analiza este resumen financiero real y responde de forma específica (no genérica).

Datos:
${JSON.stringify(summary, null, 2)}

Reglas:
- Usa números concretos del caso
- No repitas lo obvio
- Prioriza acciones claras
- Máximo 3 insights clave
- Máximo 2 riesgos importantes
- Máximo 3 recomendaciones accionables

Responde ÚNICAMENTE con JSON válido (sin markdown), siguiendo este formato exacto:
{
  "headline": "diagnóstico claro en máx 10 palabras, con números reales",
  "summary": "2 líneas máximo: situación concreta con los montos del caso",
  "insights": [
    "insight específico con número concreto",
    "insight específico con número concreto",
    "insight específico con número concreto"
  ],
  "risks": [
    "riesgo concreto basado en los datos",
    "riesgo concreto basado en los datos"
  ],
  "recommendations": [
    "paso concreto y accionable (no genérico)",
    "paso concreto y accionable (no genérico)",
    "paso concreto y accionable (no genérico)"
  ]
}`;
}

// ── JSON parser ───────────────────────────────────────────────────────────────

function parseInsights(raw: string): AiInsights | null {
  const match = /\{[\s\S]*\}/.exec(raw);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    // Minimal shape validation
    if (typeof parsed.headline === 'string' && Array.isArray(parsed.insights)) {
      return parsed as AiInsights;
    }
  } catch { /* fall through */ }
  return null;
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Tries Gemini first; falls back to OpenAI; returns a controlled error object
 * if both fail — never throws, never blocks the UI.
 */
export async function getInsights(input: InsightInput): Promise<InsightResult> {
  const prompt = buildPrompt(input);

  // 1. Gemini (primary)
  try {
    const raw  = await callGemini(prompt);
    const data = parseInsights(raw);
    if (data) {
      console.log('[ai] provider=gemini ok');
      return { ok: true, provider: 'gemini', data };
    }
  } catch (err) {
    console.error('[ai] Gemini failed:', err instanceof Error ? err.message : err);
  }

  // 2. OpenAI (fallback)
  try {
    const raw  = await callOpenAI(prompt);
    const data = parseInsights(raw);
    if (data) {
      console.log('[ai] provider=openai ok');
      return { ok: true, provider: 'openai', data };
    }
  } catch (err) {
    console.error('[ai] OpenAI failed:', err instanceof Error ? err.message : err);
  }

  // 3. Both failed — controlled non-blocking result
  console.warn('[ai] provider=none — both providers unavailable');
  return { ok: false, provider: 'none', error: 'IA temporalmente no disponible' };
}
