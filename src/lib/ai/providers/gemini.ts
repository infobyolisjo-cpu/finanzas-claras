const BASE   = 'https://generativelanguage.googleapis.com/v1beta';
const MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];
const TIMEOUT = 15_000;

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Calls Gemini with exponential backoff across models. Throws when all rounds exhaust. */
export async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });

  for (let round = 0; round < 3; round++) {
    if (round > 0) await sleep(1_000 * 2 ** (round - 1) + Math.random() * 400);

    for (const model of MODELS) {
      let res: Response;
      try {
        res = await fetch(`${BASE}/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(TIMEOUT),
        });
      } catch {
        continue; // network / timeout → try next model
      }

      if (res.status === 429 || res.status === 503 || res.status === 500) continue;

      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`Gemini ${model} ${res.status}: ${msg}`);
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }
  }

  throw new Error('Gemini: all models and retry rounds exhausted');
}
