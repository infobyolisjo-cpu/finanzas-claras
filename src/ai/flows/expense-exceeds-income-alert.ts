/**
 * @fileOverview This file defines a Genkit flow for detecting when a user's expenses exceed their income for the month.
 *
 * - `checkExpenseExceedsIncome`: Checks if expenses exceed income and returns an alert message if so.
 * - `ExpenseExceedsIncomeInput`: Input type for the checkExpenseExceedsIncome function.
 * - `ExpenseExceedsIncomeOutput`: Output type for the checkExpenseExceedsIncome function.
 */

import { ai, textModel } from '@/ai/genkit';
import { z } from 'genkit';

const ExpenseExceedsIncomeInputSchema = z.object({
  income: z.number().describe('The total income for the month.'),
  expenses: z.number().describe('The total expenses for the month.'),
});
export type ExpenseExceedsIncomeInput = z.infer<typeof ExpenseExceedsIncomeInputSchema>;

const ExpenseExceedsIncomeOutputSchema = z.object({
  alertMessage: z.string().describe('An alert message if expenses exceed income, otherwise an empty string.'),
});
export type ExpenseExceedsIncomeOutput = z.infer<typeof ExpenseExceedsIncomeOutputSchema>;

export async function checkExpenseExceedsIncome(input: ExpenseExceedsIncomeInput): Promise<ExpenseExceedsIncomeOutput> {
  return expenseExceedsIncomeFlow(input);
}

const expenseAlertPrompt = ai.definePrompt(
  {
    name: 'expenseAlertPrompt',
    inputSchema: ExpenseExceedsIncomeInputSchema,
    prompt: `You are a personal finance advisor. Given the user's monthly income and expenses, determine if the expenses exceed the income.

  If expenses exceed income, generate a concise and actionable alert message to warn the user about their spending habits and suggest reducing expenses. Be conversational, but not overly verbose.
  If expenses do not exceed income, return an empty string.

  Income: {{{income}}}
  Expenses: {{{expenses}}}

  Return the result as a JSON object with a single key "alertMessage".
  `,
  }
);


const expenseExceedsIncomeFlow = ai.defineFlow(
  {
    name: 'expenseExceedsIncomeFlow',
    inputSchema: ExpenseExceedsIncomeInputSchema,
    outputSchema: ExpenseExceedsIncomeOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await expenseAlertPrompt(input, { model: textModel, config: { temperature: 0 } });
      
      if (typeof output === 'string') {
          try {
              const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
              const jsonString = jsonMatch ? jsonMatch[1] : output;
              const parsed = JSON.parse(jsonString);
              return ExpenseExceedsIncomeOutputSchema.parse(parsed);
          } catch (e) {
              console.error("Failed to parse AI output for expense alert:", e);
              return { alertMessage: '' };
          }
      }

      return output || { alertMessage: '' };
    } catch (e: any) {
        console.error(`[expenseExceedsIncomeFlow] Error: ${e.message}`);
        // Fallback to a simple message if AI fails
        if (input.expenses > input.income) {
            return { alertMessage: "Alerta: ¡Tus gastos han superado tus ingresos este mes!" };
        }
        return { alertMessage: '' };
    }
  }
);
