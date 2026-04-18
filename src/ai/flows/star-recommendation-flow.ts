/**
 * @fileOverview This file defines a Genkit flow to provide a "star recommendation" based on financial transactions.
 *
 * It exports:
 * - `getStarRecommendation`: An async function that takes transactions and returns a star recommendation.
 */

import { ai, textModel } from '@/ai/genkit';
import { type StarRecommendationInput, StarRecommendationInputSchema, type StarRecommendationOutput, StarRecommendationOutputSchema } from '@/ai/types';

export async function getStarRecommendation(input: StarRecommendationInput): Promise<StarRecommendationOutput> {
  return starRecommendationFlow(input);
}


const starPrompt = ai.definePrompt(
  {
    name: 'starRecommendationPrompt',
    inputSchema: StarRecommendationInputSchema,
    prompt: (input) => `You are an expert financial advisor, friendly and practical. Your goal is to find the single most impactful insight from a list of transactions and present it as a "star recommendation".

Analyze the following list of transactions. Identify the most significant pattern, whether it's a high spending category, a potential saving opportunity, or an unusual expense.

Based on your analysis, generate a single, highly relevant "star recommendation".

The recommendation must include:
1.  A short, engaging title.
2.  A concise, actionable insight.
3.  A clear, simple question to prompt the user to take a action.

Transactions:
${input.transactions.map(t => `- Date: ${t.date}, Amount: ${t.amount}, Type: ${t.type}, Category: ${t.category}, Note: ${t.note}`).join('\n')}

Generate the star recommendation in JSON format.`,
  }
);


const starRecommendationFlow = ai.defineFlow(
  {
    name: 'starRecommendationFlow',
    inputSchema: StarRecommendationInputSchema,
    outputSchema: StarRecommendationOutputSchema,
  },
  async input => {
    try {
      const { output } = await starPrompt(input, { model: textModel });
      
      if (typeof output === 'string') {
          try {
              const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
              const jsonString = jsonMatch ? jsonMatch[1] : output;
              const parsed = JSON.parse(jsonString);
              return StarRecommendationOutputSchema.parse(parsed);
          } catch (e) {
              console.error("Failed to parse AI output for star recommendation:", e);
              throw new Error("Could not generate a star recommendation at this time.");
          }
      }

      return output!;
    } catch (e: any) {
        console.error(`[starRecommendationFlow] Error: ${e.message}`);
        throw new Error("Could not generate a star recommendation due to a service error.");
    }
  }
);
