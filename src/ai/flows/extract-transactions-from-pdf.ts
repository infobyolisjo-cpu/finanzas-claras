/**
 * @fileOverview This file defines a Genkit flow to extract raw transaction rows from a PDF.
 * This version processes the full text of a PDF on the server using pdf-parse.
 *
 * It exports:
 * - extractTransactionsFromPdf: An async function that orchestrates the extraction.
 */

import { extractTransactionsFromTextInternal } from '@/ai/lib/pdf-extraction-internal';
import type { ExtractTransactionsInput, ExtractTransactionsOutput } from '@/ai/types';
import * as pdf from 'pdf-parse';


/**
 * Orchestrates the transaction extraction process by calling the appropriate Genkit flow.
 * @param input The input data, containing the PDF file content as a base64 string.
 * @returns A promise that resolves to the raw extracted transaction rows.
 */
export async function extractTransactionsFromPdf(input: ExtractTransactionsInput): Promise<ExtractTransactionsOutput> {
  
  if (!input.fileContent) {
    console.warn("[extractTransactionsFromPdf] No file content provided.");
    return { transactions: [] };
  }

  try {
    const pdfBuffer = Buffer.from(input.fileContent, 'base64');
    const data = await pdf(pdfBuffer);
    const pdfText = data.text;
    
    // Debugging logs as requested
    console.log(`[PDF Debug] Total pages processed: ${data.numpages}`);
    console.log(`[PDF Debug] Total text characters extracted: ${pdfText.length}`);
    const historyRegex = /Transaction history/i;
    const match = historyRegex.exec(pdfText);
    if (match) {
        console.log('[PDF Debug] "Transaction history" found.');
        const snippetIndex = Math.max(0, match.index - 100);
        const snippet = pdfText.substring(snippetIndex, snippetIndex + 300);
        console.log(`[PDF Debug] Snippet around match:\n---\n${snippet}\n---`);
    } else {
        console.log('[PDF Debug] "Transaction history" NOT found in the full text.');
    }

    if (!pdfText || pdfText.trim().length === 0) {
      console.warn("[extractTransactionsFromPdf] PDF text content is empty. This might be a scanned PDF without text.");
      return { transactions: [] };
    }

    // Pass the extracted text to the internal flow that uses a text model
    return extractTransactionsFromTextInternal({ pdfText });
    
  } catch (error) {
    console.error("[extractTransactionsFromPdf] Failed to parse PDF or run extraction flow:", error);
    return { transactions: [] };
  }
}
