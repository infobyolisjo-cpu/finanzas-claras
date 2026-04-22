import { NextRequest, NextResponse } from 'next/server';
import { getInsights, type InsightInput } from '@/lib/ai/get-insights';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Accept both old shape { income, expenses } and new shape { InsightInput fields }
  const input: InsightInput = {
    bank:              body.bank              ?? null,
    period:            body.period            ?? null,
    income:            body.income            ?? 0,
    expenses:          body.expenses          ?? 0,
    fees:              body.fees              ?? 0,
    net:               body.net               ?? (body.income ?? 0) - (body.expenses ?? 0),
    transaction_count: body.transaction_count ?? 0,
    top_descriptions:  body.top_descriptions  ?? [],
  };

  const result = await getInsights(input);

  if (!result.ok) {
    return NextResponse.json({
      ok:            false,
      provider_used: 'none',
      error:         result.error,
      // Legacy field so existing callers don't break
      recommendation: 'Registra tus gastos diariamente para identificar oportunidades de ahorro.',
    });
  }

  return NextResponse.json({
    ok:             true,
    provider_used:  result.provider,
    data:           result.data,
    // Legacy field
    recommendation: result.data.summary,
  });
}
