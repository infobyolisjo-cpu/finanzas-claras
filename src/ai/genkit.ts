import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY!,
      apiVersion: 'v1',
    }),
  ],
  logLevel: 'warn',
});

export const textModel = googleAI.model('gemini-1.5-flash-latest');
export const visionModel = googleAI.model('gemini-1.5-flash-latest');
