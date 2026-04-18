

/**
 * @fileOverview This file defines a Genkit flow to generate actionable financial insights.
 *
 * It exports:
 * - `generateFinancialInsights`: An async function that takes transactions and returns a list of insights.
 */

'use server';

import { ai, textModel } from '@/ai/genkit';
import {
  GenerateFinancialInsightsInputSchema,
  type GenerateFinancialInsightsInput,
  GenerateFinancialInsightsOutputSchema,
  type GenerateFinancialInsightsOutput,
} from '@/ai/types';

function safeJsonParse(rawText: string): GenerateFinancialInsightsOutput | null {
    let jsonString = rawText.trim();
    
    // If it's wrapped in markdown, extract it.
    const jsonMatch = jsonString.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
    }

    // If there's still text outside, try to find the JSON block.
    if (!jsonString.startsWith('{') || !jsonString.endsWith('}')) {
        const startIndex = jsonString.indexOf('{');
        const endIndex = jsonString.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            jsonString = jsonString.substring(startIndex, endIndex + 1);
        }
    }
    
    try {
        const parsed = JSON.parse(jsonString);
        return GenerateFinancialInsightsOutputSchema.parse(parsed);
    } catch (e) {
        console.warn("safeJsonParse for insights failed:", e);
        return null;
    }
}

const insightsPromptText = `Eres un Contador Público experto y asesor financiero personal. Tu tarea es analizar una lista de transacciones del período '{{{periodDescription}}}' y generar un reporte de análisis financiero con un tono profesional, claro y humano.

REGLAS CRÍTICAS:
1.  **IDIOMA**: Tu respuesta DEBE ser 100% en español neutro. No uses inglés.
2.  **FORMATO**: Tu respuesta DEBE ser únicamente un objeto JSON válido, sin markdown (\`\`\`), comentarios o texto extra.
3.  **SEPARACIÓN DE INGRESOS Y GASTOS**: Analiza INGRESOS y GASTOS de forma separada y estricta. La clasificación de una transacción como ingreso o gasto depende ÚNICAMENTE de si el monto es positivo o negativo. El nombre del comercio (ej. "Uber") es irrelevante para esta decisión. Un mismo comercio puede aparecer tanto en el análisis de ingresos (si te pagó) como en el de gastos (si le pagaste), pero nunca deben mezclarse.
4.  **PRINCIPIOS**: Basa tu análisis en principios de claridad, consistencia y prudencia financiera. Justifica tus conclusiones con los datos.

A continuación, se presentan los TOTALES y las transacciones del período. Úsalos para generar tu análisis.

MÉTRICAS CLAVE (YA CALCULADAS):
- Ingresos Totales: {{{totalIncome}}}
- Gastos Totales: {{{totalExpense}}}
- Saldo Neto: {{{netBalance}}}

Transacciones de INGRESO (montos positivos):
{{#each incomeTransactions}}
- Fecha: {{date}}, Monto: {{amount}}, Categoría: {{category}}, Nota: {{note}}
{{/each}}
{{^if incomeTransactions}}
- No se registraron ingresos en este período.
{{/if}}

Transacciones de GASTO (montos negativos):
{{#each expenseTransactions}}
- Fecha: {{date}}, Monto: {{amount}}, Categoría: {{category}}, Nota: {{note}}
{{/each}}
{{^if expenseTransactions}}
- No se registraron gastos en este período.
{{/if}}

Ahora, genera el reporte en un objeto JSON que siga EXACTAMENTE este esquema. LOS TOTALES EN EL JSON DEBEN COINCIDIR CON LAS MÉTRICAS YA CALCULADAS QUE TE PROPORCIONÉ ARRIBA:
{
  "titulo_general": "Un titular de máximo 80 caracteres que resuma el estado del flujo de caja del mes.",
  "resumen_ejecutivo": "Un resumen de 2-4 líneas que explique el comportamiento del flujo de caja, la relación ingreso-gasto y la conclusión principal del período.",
  "metricas_generales": {
    "ingresos_totales": {{{totalIncome}}},
    "gastos_totales": {{{totalExpense}}},
    "saldo_neto": {{{netBalance}}}
  },
  "analisis_ingresos": {
    "insights": [
      "Un array de 2-3 strings con hallazgos CLAVE sobre las fuentes de ingreso (concentración, diversificación, variabilidad)."
    ],
    "top_fuentes": [
      { "nombre": "String, nombre de la fuente de ingreso", "veces": "Number, frecuencia de cobros", "monto": "Number, total recibido de esa fuente" }
    ]
  },
  "analisis_gastos": {
    "insights": [
      "Un array de 2-3 strings con hallazgos CLAVE sobre la estructura de gastos (categorías principales, gastos hormiga, etc.)."
    ],
    "top_categorias": [
      { "nombre": "String, nombre de la categoría de gasto", "monto": "Number, total gastado" }
    ],
    "top_comercios": [
      { "nombre": "String, descripción del comercio/gasto", "veces": "Number, frecuencia de pagos", "monto": "Number, total pagado" }
    ]
  },
  "alertas_riesgos": [
    "Un array de 2-4 strings. Alertas sobre riesgos reales: flujo de caja negativo, comisiones bancarias, posibles cargos duplicados, picos de gasto inusuales, bajo nivel de ahorro."
  ],
  "recomendaciones_accionables": [
    "Un array de 3-5 strings. Cada uno una acción concreta y justificada con el formato: (Verbo + Qué hacer + Para qué)."
  ]
}

EJEMPLO DE RESPUESTA JSON VÁLIDA:
{
  "titulo_general": "Flujo de caja positivo, pero alta concentración en gastos de consumo discrecional.",
  "resumen_ejecutivo": "Este mes, tus ingresos lograron cubrir la totalidad de tus gastos, generando un excedente de liquidez. Sin embargo, se observa una estructura de costos con un peso significativo en categorías no esenciales como 'Comida' y 'Compras', lo cual representa una oportunidad de optimización para incrementar el ahorro.",
  "metricas_generales": { "ingresos_totales": 3500, "gastos_totales": 2150.50, "saldo_neto": 1349.50 },
  "analisis_ingresos": {
    "insights": [
      "El 95% de tus ingresos proviene de una única fuente ('Salario'), lo que indica una alta dependencia.",
      "Se registró un ingreso extraordinario clasificado como 'Regalos Recibidos' por $150."
    ],
    "top_fuentes": [
      { "nombre": "Nómina Empresa XYZ", "veces": 2, "monto": 3350 }
    ]
  },
  "analisis_gastos": {
    "insights": [
      "La categoría 'Comida' representa el 39% de tus gastos totales, siendo el principal rubro de egreso.",
      "Se identifican 15 transacciones en 'Transporte' con un monto total de $250.75, principalmente en un solo comercio."
    ],
    "top_categorias": [ { "nombre": "Comida", "monto": 850.25 }, { "nombre": "Transporte", "monto": 450.00 } ],
    "top_comercios": [ { "nombre": "UBER TRIP", "veces": 15, "monto": 250.75 }, { "nombre": "STARBUCKS", "veces": 10, "monto": 120.50 } ]
  },
  "alertas_riesgos": [
    "Se detectó una comisión por servicio mensual de $15 que impacta directamente tu saldo.",
    "El alto gasto en 'Comida' podría comprometer tu capacidad de ahorro a largo plazo si no se controla."
  ],
  "recomendaciones_accionables": [
    "Establece un presupuesto mensual de $400 para la categoría 'Comida' para controlar tu principal área de gasto y liberar flujo de caja.",
    "Automatiza una transferencia de $150 a una cuenta de ahorro a principio de mes para capitalizar tu excedente de manera sistemática.",
    "Evalúa tus suscripciones actuales para identificar y cancelar servicios no utilizados, optimizando pequeños gastos recurrentes."
  ]
}

Ahora, genera el reporte JSON para las transacciones proporcionadas.
`;


export async function generateFinancialInsights(input: GenerateFinancialInsightsInput): Promise<GenerateFinancialInsightsOutput> {
  if (input.transactions.length < 1) {
    throw new Error("Se necesita al menos 1 transacción en el período para un análisis significativo.");
  }

  let firstAttemptOutput: string | null = null;
  let secondAttemptOutput: string | null = null;
  
  try {
    const incomeTransactions = input.transactions.filter(t => t.type === 'income');
    const expenseTransactions = input.transactions.filter(t => t.type === 'expense');

    // Calculate totals deterministically
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
    const netBalance = totalIncome - totalExpense;

    let filledPrompt = insightsPromptText
        .replace('{{{periodDescription}}}', input.periodDescription)
        .replace(/{{{totalIncome}}}/g, totalIncome.toFixed(2))
        .replace(/{{{totalExpense}}}/g, totalExpense.toFixed(2))
        .replace(/{{{netBalance}}}/g, netBalance.toFixed(2));


    const incomeTxsString = incomeTransactions.map(t => `- Fecha: ${t.date}, Monto: ${t.amount}, Categoría: ${t.category}, Nota: ${t.note}`).join('\n');
    const expenseTxsString = expenseTransactions.map(t => `- Fecha: ${t.date}, Monto: ${-t.amount}, Categoría: ${t.category}, Nota: ${t.note}`).join('\n');

    filledPrompt = filledPrompt.replace('{{#each incomeTransactions}}', incomeTxsString || '{{^if incomeTransactions}}');
    filledPrompt = filledPrompt.replace('{{#each expenseTransactions}}', expenseTxsString || '{{^if expenseTransactions}}');
    filledPrompt = filledPrompt.replace('{{^if incomeTransactions}}', incomeTransactions.length ? '' : '- No se registraron ingresos en este período.');
    filledPrompt = filledPrompt.replace('{{^if expenseTransactions}}', expenseTransactions.length ? '' : '- No se registraron gastos en este período.');


    // First attempt
    const { text: firstResponseText } = await ai.generate({
        model: textModel,
        prompt: filledPrompt,
        config: { temperature: 0.2 }
    });

    if (firstResponseText) {
        firstAttemptOutput = firstResponseText;
        const parsedOutput = safeJsonParse(firstResponseText);
        if (parsedOutput) {
            // Ensure AI doesn't hallucinate different totals
            parsedOutput.metricas_generales.ingresos_totales = totalIncome;
            parsedOutput.metricas_generales.gastos_totales = totalExpense;
            parsedOutput.metricas_generales.saldo_neto = netBalance;
            return parsedOutput;
        }
    }
    
    // If we are here, the first attempt failed. Let's retry.
    console.warn("[generateFinancialInsights] First attempt to parse AI response failed. Retrying...");
    
    const retryPrompt = `Tu respuesta anterior no era un JSON válido. Por favor, corrígela.

REGLAS CRÍTICAS:
1.  **IDIOMA**: Responde SIEMPRE en español.
2.  **FORMATO**: Devuelve ÚNICAMENTE un objeto JSON válido, sin texto extra, explicaciones o markdown. Los totales deben ser: ingresos ${totalIncome}, gastos ${totalExpense}.

Respuesta anterior incorrecta:
---
${firstAttemptOutput}
---

Devuelve solo el objeto JSON corregido.`;

    const { text: secondResponseText } = await ai.generate({
        model: textModel,
        prompt: retryPrompt,
        config: { temperature: 0.0 }
    });

    if (secondResponseText) {
        secondAttemptOutput = secondResponseText;
        const parsedOutput = safeJsonParse(secondResponseText);
        if (parsedOutput) {
            // Ensure AI doesn't hallucinate different totals
            parsedOutput.metricas_generales.ingresos_totales = totalIncome;
            parsedOutput.metricas_generales.gastos_totales = totalExpense;
            parsedOutput.metricas_generales.saldo_neto = netBalance;
            return parsedOutput;
        }
    }

    // If we are here, both attempts failed.
    throw new Error('La IA no pudo generar un JSON válido después de dos intentos.');

  } catch (error: any) {
    console.error("Error during financial insights flow:", error.message);
    console.error("RAW AI Output (Attempt 1):", firstAttemptOutput?.substring(0, 500));
    console.error("RAW AI Output (Attempt 2):", secondAttemptOutput?.substring(0, 500));
    
    throw new Error(`Failed to generate financial insights: ${error.message}`);
  }
}
