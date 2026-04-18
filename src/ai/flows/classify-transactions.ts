/**
 * @fileOverview This file defines a Genkit flow to classify transactions into categories.
 *
 * It exports:
 * - `classifyTransactions`: An async function that takes a list of transactions and returns a list of categories.
 */

import { ai } from '@/ai/genkit';
import { textModel } from '@/ai/genkit';
import {
  ClassifyTransactionsInputSchema,
  type ClassifyTransactionsInput,
  ClassifyTransactionsOutputSchema,
  type ClassifyTransactionsOutput,
} from '@/ai/types';

export async function classifyTransactions(input: ClassifyTransactionsInput): Promise<ClassifyTransactionsOutput> {
  return classifyTransactionsFlow(input);
}

const transactionsListPrompt = ai.definePrompt(
  {
    name: 'classifyTransactionsPrompt',
    inputSchema: ClassifyTransactionsInputSchema,
    prompt: `Eres un asistente experto en finanzas personales. Tu tarea es clasificar transacciones bancarias en categorías predefinidas.

Categorías disponibles (usa SOLO el "value"):
{{{categoryList}}}

REGLAS CRÍTICAS (NO TE EQUIVOQUES):
1) NO calcules totales. SOLO clasifica.
2) No cambies el monto. NO lo reinterpretes.
3) La dirección (ingreso/gasto) la determina el signo del monto:
   - amount > 0 = ingreso (income)
   - amount < 0 = gasto (expense)
4) Transferencias:
   - Si parece movimiento interno (transferencia entre cuentas, pago de tarjeta, Zelle/ACH/Wire entre propias cuentas, "PAYMENT", "ONLINE TRANSFER", "CREDIT CARD PAYMENT", "pago tdc", "transfer", "zelle"), clasifica como "transfer" aunque sea ingreso o gasto.
5) Si no encaja claramente, usa "other".

FORMATO DE RESPUESTA (OBLIGATORIO):
Devuelve SOLO JSON válido, sin markdown, sin texto extra, sin \`\`\`:
{
  "categories": ["food", "transfer", "salary", ...]
}

Transacciones a clasificar (mismo orden):
{{#each transactions}}- "{{description}}", amount: {{amount}}
{{/each}}`
  }
);


const classifyTransactionsFlow = ai.defineFlow(
  {
    name: 'classifyTransactionsFlow',
    inputSchema: ClassifyTransactionsInputSchema,
    outputSchema: ClassifyTransactionsOutputSchema,
  },
  async (input) => {
    if (input.transactions.length === 0) {
      return { categories: [] };
    }

    try {
      const { output } = await transactionsListPrompt(input, { model: textModel });

      if (typeof output === 'string') {
          try {
              const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
              const jsonString = jsonMatch ? jsonMatch[1] : output;
              const parsed = JSON.parse(jsonString);
              return ClassifyTransactionsOutputSchema.parse(parsed);
          } catch (e) {
              console.error("Failed to parse AI output for classification:", e);
              // Fallback to 'other' for all transactions if parsing fails
              return { categories: input.transactions.map(() => 'other') };
          }
      }
      
      return output || { categories: [] };
    } catch (e: any) {
        console.error(`[classifyTransactionsFlow] Error: ${e.message}`);
        // In case of service unavailable or other errors, return a default 'other' for all.
        return { categories: input.transactions.map(() => 'other') };
    }
  }
);
