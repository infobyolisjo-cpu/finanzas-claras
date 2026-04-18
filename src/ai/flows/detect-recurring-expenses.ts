/**
 * @fileOverview This file defines a Genkit flow to detect recurring expenses from a list of transactions.
 *
 * It exports:
 * - `detectRecurringExpenses`: An async function that takes a list of transactions and returns a list of recurring expenses.
 */

import { ai, textModel } from '@/ai/genkit';
import { type DetectRecurringExpensesInput, DetectRecurringExpensesInputSchema, type DetectRecurringExpensesOutput, DetectRecurringExpensesOutputSchema } from '@/ai/types';


export async function detectRecurringExpenses(input: DetectRecurringExpensesInput): Promise<DetectRecurringExpensesOutput> {
  return detectRecurringExpensesFlow(input);
}

const recurringExpensesPrompt = ai.definePrompt(
  {
    name: 'recurringExpensesPrompt',
    inputSchema: DetectRecurringExpensesInputSchema,
    prompt: (input) => `You are an expert financial analyst. Analyze the following list of transactions and identify any recurring expenses. Recurring expenses are those that occur regularly, such as rent, subscriptions, or regular bills.

Transactions:
${input.transactions.map(t => `- Date: ${t.date}, Amount: ${t.amount}, Type: ${t.type}, Category: ${t.category}, Note: ${t.note}`).join('\n')}

Analyze these transaction records, identify recurring expense patterns and output them in JSON format.
Focus on expenses with similar amounts that repeat on a weekly, bi-weekly, or monthly basis.
The output should be a JSON object with a 'recurringExpenses' key, which is an array of objects.`,
  }
);

const detectRecurringExpensesFlow = ai.defineFlow(
  {
    name: 'detectRecurringExpensesFlow',
    inputSchema: DetectRecurringExpensesInputSchema,
    outputSchema: DetectRecurringExpensesOutputSchema,
  },
  async input => {
    if (input.transactions.length === 0) {
      return { recurringExpenses: [] };
    }

    try {
      const { output } = await recurringExpensesPrompt(input, { model: textModel });

      if (typeof output === 'string') {
          try {
              const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
              const jsonString = jsonMatch ? jsonMatch[1] : output;
              const parsed = JSON.parse(jsonString);
              return DetectRecurringExpensesOutputSchema.parse(parsed);
          } catch (e) {
              console.error("Failed to parse AI output for recurring expenses:", e);
              return { recurringExpenses: [] };
          }
      }

      return output || { recurringExpenses: [] };
    } catch (e: any) {
        console.error(`[detectRecurringExpensesFlow] Error: ${e.message}`);
        return { recurringExpenses: [] };
    }
  }
);
