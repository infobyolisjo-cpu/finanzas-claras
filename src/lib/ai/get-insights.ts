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

  return `Eres una asesora financiera personal experta. Analiza este resumen financiero y genera insights en español.

Datos:
- Banco: ${input.bank ?? 'No identificado'}
- Período: ${input.period ?? 'No identificado'}
- Ingresos: ${mxn(input.income)}
- Gastos: ${mxn(input.expenses)}
- Comisiones: ${mxn(input.fees)}
- Saldo neto: ${mxn(input.net)}
- Tasa de ahorro: ${savingsRate}%
- Movimientos: ${input.transaction_count}
- Principales conceptos: ${input.top_descriptions.slice(0, 6).join(', ') || 'No identificados'}

Responde ÚNICAMENTE con JSON válido (sin markdown):
{
  "headline": "título corto y claro (máx 10 palabras)",
  "summary": "resumen ejecutivo en 2-3 oraciones concretas",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "risks": ["riesgo 1", "riesgo 2"],
  "recommendations": ["recomendación 1", "recomendación 2", "recomendación 3"]
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
