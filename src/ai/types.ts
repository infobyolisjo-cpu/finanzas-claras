
import {z} from 'genkit';

const TransactionSchema = z.object({
  id: z.string().optional().describe('The unique ID of the transaction.'),
  date: z.string().describe('The date of the transaction (YYYY-MM-DD).'),
  amount: z.number().describe('The amount of the transaction.'),
  type: z.enum(['income', 'expense']).describe('The type of the transaction (income or expense).'),
  category: z.string().describe('The category of the transaction.'),
  note: z.string().optional().describe('A note about the transaction.'),
});

export type Transaction = z.infer<typeof TransactionSchema>;

export const DetectRecurringExpensesInputSchema = z.object({
  transactions: z.array(TransactionSchema).describe('A list of transactions to analyze.'),
});

export type DetectRecurringExpensesInput = z.infer<typeof DetectRecurringExpensesInputSchema>;

const RecurringExpenseSchema = z.object({
  category: z.string().describe('The category of the recurring expense.'),
  averageAmount: z.number().describe('The average amount of the recurring expense.'),
  frequency: z.enum(['monthly', 'weekly', 'bi-weekly', 'daily']).describe('The frequency of the recurring expense (e.g., monthly, weekly).'),
  exampleTransactions: z.array(TransactionSchema).describe('Example transactions that match this recurring expense.'),
});

export type RecurringExpense = z.infer<typeof RecurringExpenseSchema>;

export const DetectRecurringExpensesOutputSchema = z.object({
  recurringExpenses: z.array(RecurringExpenseSchema).describe('A list of recurring expenses detected in the transactions.'),
});

export type DetectRecurringExpensesOutput = z.infer<typeof DetectRecurringExpensesOutputSchema>;


export const StarRecommendationInputSchema = z.object({
    transactions: z.array(TransactionSchema).describe('A list of transactions to analyze.'),
});
  
export type StarRecommendationInput = z.infer<typeof StarRecommendationInputSchema>;
  
  
export const StarRecommendationOutputSchema = z.object({
      title: z.string().describe('A short, engaging title for the recommendation. For example: "Reduce your spending on dining out".'),
      recommendation: z.string().describe('The main insight or "star recommendation". It should be a concise, actionable piece of advice. For example: "We noticed you spent $250 on restaurants this month. Reducing this could significantly boost your savings."'),
      question: z.string().describe('A clear, simple question to prompt the user to take action. For example: "Would you like to set a budget for this category?"'),
});
  
export type StarRecommendationOutput = z.infer<typeof StarRecommendationOutputSchema>;


// New types for Financial Insights
export const GenerateFinancialInsightsInputSchema = z.object({
  transactions: z.array(TransactionSchema).describe('Lista de transacciones para analizar.'),
  periodDescription: z.string().describe('Descripción del período que se está analizando (ej. "este mes", "últimos 90 días").'),
});

export type GenerateFinancialInsightsInput = z.infer<typeof GenerateFinancialInsightsInputSchema>;

export const GenerateFinancialInsightsOutputSchema = z.object({
  titulo_general: z.string(),
  resumen_ejecutivo: z.string(),
  metricas_generales: z.object({
    ingresos_totales: z.number(),
    gastos_totales: z.number(),
    saldo_neto: z.number(),
  }),
  analisis_ingresos: z.object({
    insights: z.array(z.string()),
    top_fuentes: z.array(z.object({ nombre: z.string(), veces: z.number(), monto: z.number() })),
  }),
  analisis_gastos: z.object({
    insights: z.array(z.string()),
    top_categorias: z.array(z.object({ nombre: z.string(), monto: z.number() })),
    top_comercios: z.array(z.object({ nombre: z.string(), veces: z.number(), monto: z.number() })),
  }),
  alertas_riesgos: z.array(z.string()),
  recomendaciones_accionables: z.array(z.string()),
});

export type GenerateFinancialInsightsOutput = z.infer<typeof GenerateFinancialInsightsOutputSchema>;


// New types for Transaction Classification
const ClassifyTransactionItemSchema = z.object({
  description: z.string().describe("The transaction description from the bank statement."),
  amount: z.number().describe("The transaction amount (negative for expenses, positive for income)."),
});

export const ClassifyTransactionsInputSchema = z.object({
  transactions: z.array(ClassifyTransactionItemSchema),
  categoryList: z.string().describe("A formatted string listing available categories."),
});
export type ClassifyTransactionsInput = z.infer<typeof ClassifyTransactionsInputSchema>;

export const ClassifyTransactionsOutputSchema = z.object({
  categories: z.array(z.string()).describe("An array of category 'value' strings, one for each transaction in the same order."),
});
export type ClassifyTransactionsOutput = z.infer<typeof ClassifyTransactionsOutputSchema>;

// Types for PDF Extraction
export const PdfTransactionRowSchema = z.object({
  date: z.string().describe("The date string exactly as it appears in the transaction row."),
  description: z.string().describe("The full, unmodified description text of the transaction."),
  depositsCredits: z.number().nullable().describe("The numeric value from the 'Deposits/Credits' column, or null if empty."),
  withdrawalsDebits: z.number().nullable().describe("The numeric value from the 'Withdrawals/Debits' column, or null if empty."),
  dailyBalance: z.number().nullable().describe("The numeric value from the 'Balance' column, or null if empty."),
});
export type PdfTransactionRow = z.infer<typeof PdfTransactionRowSchema>;


export const ExtractTransactionsInputSchema = z.object({
  fileContent: z.string().describe(
    "The content of the PDF file, base64 encoded."
  ),
});
export type ExtractTransactionsInput = z.infer<typeof ExtractTransactionsInputSchema>;

export const ExtractTransactionsFromTextInputSchema = z.object({
  pdfText: z.string().describe(
    "The full text content of a PDF file."
  ),
});
export type ExtractTransactionsFromTextInput = z.infer<typeof ExtractTransactionsFromTextInputSchema>;

export const ExtractTransactionsOutputSchema = z.object({
  transactions: z.array(PdfTransactionRowSchema).describe("An array of raw transaction rows extracted from the document."),
});
export type ExtractTransactionsOutput = z.infer<typeof ExtractTransactionsOutputSchema>;


// New types for PDF Statement Analysis
export const AnalyzeStatementPdfInputSchema = z.object({
  fileContent: z.string().describe("The content of the PDF file, base64 encoded."),
});
export type AnalyzeStatementPdfInput = z.infer<typeof AnalyzeStatementPdfInputSchema>;


export const AnalyzeStatementPdfOutputSchema = z.object({
  bankName: z.string().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  totals: z.object({
    deposits: z.number(),
    withdrawals: z.number(),
    fees: z.number(),
    net: z.number(),
  }),
  analysis: z.object({
      headline: z.string(),
      summary: z.string(),
      insights: z.array(z.string()),
      risks: z.array(z.string()),
      recommendations: z.array(z.string()),
    }).nullable(),
});
export type AnalyzeStatementPdfOutput = z.infer<typeof AnalyzeStatementPdfOutputSchema>;
