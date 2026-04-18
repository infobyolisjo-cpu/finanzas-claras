
'use server';

/**
 * @fileOverview This file defines a Genkit flow to analyze a bank statement from a PDF.
 * It extracts a summary, totals, and optionally transactions.
 */

import { ai, textModel } from '@/ai/genkit';
import { z } from 'zod';
import {
  AnalyzeStatementPdfInputSchema,
  type AnalyzeStatementPdfInput,
  AnalyzeStatementPdfOutputSchema,
  type AnalyzeStatementPdfOutput,
} from '@/ai/types';
import * as pdf from 'pdf-parse';

async function extractTextFromPdf(fileContent: string): Promise<string> {
  const pdfBuffer = Buffer.from(fileContent, 'base64');
  const data = await pdf(pdfBuffer);
  return data.text;
}

const BANKS: Record<string, string[]> = {
    "Wells Fargo": ["WELLS FARGO"],
    "Chase": ["CHASE", "JPMORGAN"],
    "Bank of America": ["BANK OF AMERICA"],
    "Citibank": ["CITI", "CITIBANK"],
};

function detectBank(text: string): string | null {
    const lowerText = text.toLowerCase();
    for (const bankName in BANKS) {
        if (BANKS[bankName].some(keyword => lowerText.includes(keyword.toLowerCase()))) {
            return bankName;
        }
    }
    return null;
}

function detectPeriod(text: string): { periodStart: string | null, periodEnd: string | null } {
    // Regex patterns to find statement periods
    const patterns = [
        /Statement period:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|-|through)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
        /From\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*through\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
        /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1] && match[2]) {
            return { periodStart: match[1], periodEnd: match[2] };
        }
    }

    // Fallback for month and year only, e.g., "November 1 - November 30, 2023"
    const monthYearPattern = /(\w+\s+\d{1,2})\s*through\s*(\w+\s+\d{1,2},\s*\d{4})/i;
    const monthYearMatch = text.match(monthYearPattern);
    if(monthYearMatch && monthYearMatch[1] && monthYearMatch[2]) {
        const year = monthYearMatch[2].split(',')[1].trim();
        return { periodStart: `${monthYearMatch[1]}, ${year}`, periodEnd: monthYearMatch[2]};
    }

    return { periodStart: null, periodEnd: null };
}


const promptInstructions = `Eres un asesor financiero personal experto. Tu tarea es analizar el texto de un estado de cuenta y generar un análisis financiero completo.

REGLAS CRÍTICAS:
1.  **RESPONDE SIEMPRE EN ESPAÑOL NEUTRO.** Todo el texto generado, incluyendo títulos, resúmenes y listas, debe estar en español. No uses inglés.
2.  **RESPUESTA ESTRICTAMENTE EN FORMATO JSON.** Tu respuesta DEBE ser únicamente un objeto JSON válido. No incluyas texto extra, explicaciones, ni markdown como \`\`\`json. Solo el objeto JSON.

Un humano ya ha detectado la siguiente información (úsala como referencia):
- Bank Name: {{{bankName}}}
- Period Start: {{{periodStart}}}
- Period End: {{{periodEnd}}}

El esquema JSON que debes seguir es EXACTAMENTE este:
{
  "bankName": "string | null",
  "periodStart": "string | null",
  "periodEnd": "string | null",
  "totals": {
    "deposits": "number",
    "withdrawals": "number",
    "fees": "number",
    "net": "number"
  },
  "analysis": {
    "headline": "Un titular corto y atractivo para el análisis (máx. 10 palabras). En español.",
    "summary": "Un resumen ejecutivo de 3 a 5 líneas sobre la salud financiera del usuario para este período, interpretando los números. En español.",
    "insights": ["string"],
    "risks": ["string"],
    "recommendations": ["string"]
  }
}

EJEMPLO DE RESPUESTA VÁLIDA:
{
  "bankName": "Wells Fargo",
  "periodStart": "10/01/2023",
  "periodEnd": "10/31/2023",
  "totals": {
    "deposits": 3000,
    "withdrawals": 1888.89,
    "fees": 15,
    "net": 1096.11
  },
  "analysis": {
    "headline": "Flujo de caja positivo, pero los gastos en comida son un área de oportunidad.",
    "summary": "Este mes, tus ingresos superaron tus gastos, lo que te dejó con un saldo neto positivo. Sin embargo, una parte significativa de tus egresos se destinó a restaurantes. Optimizar esta área podría mejorar aún más tus finanzas.",
    "insights": [
      "Tus ingresos de $3000 cubrieron todos tus gastos del mes, generando un excedente.",
      "El gasto en 'Comida' fue tu categoría más alta, representando casi el 40% del total de retiros.",
      "Lograste mantener tus gastos de transporte por debajo del promedio de meses anteriores."
    ],
    "risks": [
      "Se detectó una nueva comisión por servicio mensual de $15 que antes no estaba presente.",
      "Hay varios gastos pequeños en 'Suscripciones' que, sumados, representan un monto considerable y podrían estar pasando desapercibidos.",
      "Tu saldo final es positivo, pero relativamente bajo, lo que podría ser un riesgo ante un gasto inesperado."
    ],
    "recommendations": [
      "Revisa detalladamente tus suscripciones para identificar y cancelar las que ya no utilizas.",
      "Considera establecer un presupuesto específico de $300 para la categoría 'Comida' el próximo mes.",
      "Contacta a tu banco para preguntar sobre la nueva comisión por servicio y si hay forma de evitarla."
    ]
  }
}

Ahora, analiza el siguiente texto del estado de cuenta. Recuerda: tu respuesta debe ser solamente el objeto JSON.
---
{{{input}}}
---
`;


function safeJsonParse(rawText: string): AnalyzeStatementPdfOutput | null {
    let jsonString = rawText.trim();

    // 1. If it's wrapped in markdown, extract it.
    const jsonMatch = jsonString.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
    }

    // 2. If there's still text outside, try to find the JSON block.
    if (!jsonString.startsWith('{') || !jsonString.endsWith('}')) {
        const startIndex = jsonString.indexOf('{');
        const endIndex = jsonString.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            jsonString = jsonString.substring(startIndex, endIndex + 1);
        }
    }
    
    try {
        const parsed = JSON.parse(jsonString);
        return AnalyzeStatementPdfOutputSchema.parse(parsed);
    } catch(e) {
        console.warn("safeJsonParse failed:", e);
        return null;
    }
}


export async function analyzeStatementPdf(input: AnalyzeStatementPdfInput): Promise<AnalyzeStatementPdfOutput> {

  if (!textModel) {
    throw new Error("El modelo de IA no está configurado. Asegúrate de que la clave API de Gemini esté configurada en el entorno.");
  }

  const rawText = await extractTextFromPdf(input.fileContent);

  if (!rawText || rawText.trim().length < 100) {
     return {
      bankName: null,
      periodStart: null,
      periodEnd: null,
      totals: { deposits: 0, withdrawals: 0, fees: 0, net: 0 },
      analysis: {
        headline: "PDF no legible",
        summary: "El archivo PDF no contiene texto legible o está vacío. Por favor, intenta subir un extracto diferente o un archivo CSV/XLSX.",
        insights: [],
        risks: [],
        recommendations: []
      },
    };
  }

  // Deterministic pre-processing
  const detectedBank = detectBank(rawText);
  const { periodStart, periodEnd } = detectPeriod(rawText);
  console.log(`[PDF Pre-Process] Detected Bank: ${detectedBank}, Period: ${periodStart}-${periodEnd}`);
  console.log(`[PDF Pre-Process] sourceTextSnippet:`, rawText.substring(0, 1200));

  
  let firstAttemptOutput: string | null = null;
  let secondAttemptOutput: string | null = null;

  try {
    const promptWithContext = promptInstructions
      .replace('{{{input}}}', rawText)
      .replace('{{{bankName}}}', detectedBank || 'not detected')
      .replace('{{{periodStart}}}', periodStart || 'not detected')
      .replace('{{{periodEnd}}}', periodEnd || 'not detected');
    
    // First attempt
    const { text: firstResponseText } = await ai.generate({
        model: textModel,
        prompt: promptWithContext,
        config: {
            temperature: 0.1,
            maxOutputTokens: 8192,
        }
    });

    if (firstResponseText) {
        firstAttemptOutput = firstResponseText;
        const parsedOutput = safeJsonParse(firstResponseText);
        if (parsedOutput) {
            // Override with deterministically found values for accuracy
            parsedOutput.bankName = detectedBank || parsedOutput.bankName;
            parsedOutput.periodStart = periodStart || parsedOutput.periodStart;
            parsedOutput.periodEnd = periodEnd || parsedOutput.periodEnd;
            return parsedOutput;
        }
    }
    
    // If we are here, the first attempt failed. Let's retry.
    console.warn("[analyzeStatementPdf] First attempt to parse AI response failed. Retrying...");
    
    const retryPrompt = `Tu respuesta anterior no fue un JSON válido. Por favor, corrígela.

REGLAS CRÍTICAS:
1. Responde SIEMPRE en español.
2. Tu respuesta debe ser ÚNICAMENTE el objeto JSON. Sin texto extra, sin explicaciones, sin markdown.

Respuesta anterior:
---
${firstAttemptOutput}
---

Devuelve solo el objeto JSON corregido.`;

    const { text: secondResponseText } = await ai.generate({
        model: textModel,
        prompt: retryPrompt,
        config: {
            temperature: 0.0,
            maxOutputTokens: 8192,
        }
    });

    if (secondResponseText) {
        secondAttemptOutput = secondResponseText;
        const parsedOutput = safeJsonParse(secondResponseText);
        if (parsedOutput) {
            // Override with deterministically found values for accuracy
            parsedOutput.bankName = detectedBank || parsedOutput.bankName;
            parsedOutput.periodStart = periodStart || parsedOutput.periodStart;
            parsedOutput.periodEnd = periodEnd || parsedOutput.periodEnd;
            return parsedOutput;
        }
    }

    // If we are here, both attempts failed.
    throw new Error('La IA no pudo generar un JSON válido después de dos intentos.');

  } catch (error: any) {
    console.error("Error during statement analysis flow:", error.message);
    console.error("RAW AI Output (Attempt 1):", firstAttemptOutput?.substring(0, 500));
    console.error("RAW AI Output (Attempt 2):", secondAttemptOutput?.substring(0, 500));
    
    throw new Error(`Failed to analyze PDF: ${error.message}`);
  }
}
