import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { income, expenses } = await request.json();
  const balance = income - expenses;
  const savingsRate = income > 0 ? ((balance / income) * 100).toFixed(1) : 0;

  const prompt = `Eres un asesor financiero personal conciso y empático.
Analiza esta situación financiera mensual y da UNA recomendación práctica y específica en 2-3 oraciones máximo.
Sé directo, positivo y accionable. Escribe en español.

Datos:
- Ingresos mensuales: $${income.toLocaleString()}
- Gastos mensuales: $${expenses.toLocaleString()}
- Saldo disponible: $${balance.toLocaleString()}
- Tasa de ahorro: ${savingsRate}%

Recomendación:`;

  const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash'];

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 150, temperature: 0.7 },
          }),
        }
      );

      if (response.status === 503 || response.status === 429) continue;

      const data = await response.json();
      const recommendation = data.candidates?.[0]?.content?.parts?.[0]?.text ??
        'Registra tus gastos diariamente para identificar oportunidades de ahorro.';

      return NextResponse.json({ recommendation });
    } catch {
      continue;
    }
  }

  return NextResponse.json({
    recommendation: 'Registra tus gastos diariamente para identificar oportunidades de ahorro.',
  });
}
