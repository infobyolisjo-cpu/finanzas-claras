
import { ai, textModel } from '@/ai/genkit';
import {
  ExtractTransactionsFromTextInputSchema,
  ExtractTransactionsOutputSchema,
  type ExtractTransactionsOutput,
  PdfTransactionRowSchema,
  type PdfTransactionRow,
} from '@/ai/types';


const promptInstructions = `You are a data extraction expert. Your ONLY job is to find the transaction table in the provided bank statement text and extract all transaction rows into a valid JSON format.

The bank statement text is provided below. Find the main transaction list/table, which contains columns like "Date", "Description", "Deposits/Credits", "Withdrawals/Debits", and "Balance".

A transaction row is defined by having a date, a description, and at least one numerical amount in a credit, debit, or balance column.

Follow these rules STRICTLY:
1.  **Extract Raw Values**: For each valid row, extract values for: \`date\`, \`description\`, \`depositsCredits\`, \`withdrawalsDebits\`, \`dailyBalance\`.
2.  **DO NOT INTERPRET OR CALCULATE**: Do NOT sum, aggregate, classify, or format dates/numbers. Extract them as-is.
3.  **IGNORE NON-TRANSACTION ROWS**: Aggressively discard headers, footers, summaries, and informational text that are not part of a transaction row.
4.  **Handle Nulls**: If a column for a transaction is empty (e.g., a "Deposits/Credits" column is blank for a withdrawal), the value in the JSON for that field MUST be \`null\`, not 0 or an empty string.

Your output MUST be a JSON object with a single "transactions" key, containing an array of the transaction objects. If no valid transaction rows are found, return an empty array.

Example of a perfect output for one row:
{
  "transactions": [
    {
      "date": "09/15",
      "description": "DEBIT CARD PURCHASE 123456 SOME STORE",
      "depositsCredits": null,
      "withdrawalsDebits": 55.43,
      "dailyBalance": 1234.56
    }
  ]
}

Here is the bank statement text to analyze:
`;

const extractionPrompt = ai.definePrompt(
  {
    name: 'pdfTextExtractionPrompt',
    input: { schema: ExtractTransactionsFromTextInputSchema },
    output: { schema: ExtractTransactionsOutputSchema },
    prompt: `${promptInstructions}\n{{{pdfText}}}`,
    config: { temperature: 0.0 },
  }
);


// Wells Fargo Specific Fallback Parser
const parseWellsFargoText = (text: string): PdfTransactionRow[] => {
    const transactions: PdfTransactionRow[] = [];
    const historyRegex = /Transaction history/i;
    const totalsRegex = /Totals/i;

    const historyMatch = historyRegex.exec(text);
    if (!historyMatch) {
        console.log("[WellsFargo Parser] 'Transaction history' section not found.");
        return [];
    }

    const startIndex = historyMatch.index;
    const textFromHistory = text.substring(startIndex);
    const totalsMatch = totalsRegex.exec(textFromHistory);
    const endIndex = totalsMatch ? startIndex + totalsMatch.index : -1;
    
    const transactionBlock = endIndex !== -1 ? text.substring(startIndex, endIndex) : text.substring(startIndex);

    if (!transactionBlock) {
        console.log("[WellsFargo Parser] Could not isolate transaction block.");
        return [];
    }
    
    const lines = transactionBlock.split('\n');
    let currentTransaction: Partial<PdfTransactionRow> & { descriptionLines: string[] } | null = null;

    const dateRegex = /^\s*(\d{1,2}\/\d{1,2})/; // Matches MM/DD or M/D at the start of a line

    for (const line of lines) {
        const dateMatch = line.match(dateRegex);

        if (dateMatch) {
            // A new transaction line starts. Save the previous one if it exists.
            if (currentTransaction) {
                const finalTx = processTransactionBlock(currentTransaction);
                if (finalTx) transactions.push(finalTx);
            }
            // Start a new transaction
            currentTransaction = { date: dateMatch[1].trim(), descriptionLines: [] };
        }
        
        if (currentTransaction) {
            currentTransaction.descriptionLines.push(line.replace(dateRegex, '').trim());
        }
    }
    
    // Save the very last transaction
    if (currentTransaction) {
        const finalTx = processTransactionBlock(currentTransaction);
        if (finalTx) transactions.push(finalTx);
    }
    
    console.log(`[WellsFargo Parser] Detected and parsed ${transactions.length} transactions.`);
    return transactions;
};

const processTransactionBlock = (txBlock: { date: string, descriptionLines: string[] }): PdfTransactionRow | null => {
    const fullDescription = txBlock.descriptionLines.join(' ').trim();
    const numbersRegex = /(-?[\d,]+\.\d{2})/g;
    const matches = fullDescription.match(numbersRegex);
    
    if (!matches || matches.length === 0) return null; // No numbers found

    const numbers = matches.map(n => parseFloat(n.replace(/,/g, '')));

    let amount = null;
    let balance = null;
    
    // Logic: if there are two numbers at the end, the first is the amount, the second is the balance.
    // If there is one, it's the amount.
    if (numbers.length >= 2) {
        amount = numbers[numbers.length - 2];
        balance = numbers[numbers.length - 1];
    } else if (numbers.length === 1) {
        amount = numbers[0];
    } else {
        return null; // Can't determine amount
    }

    let descriptionText = fullDescription;
    // Clean description by removing the amounts
    matches.forEach(m => {
        descriptionText = descriptionText.replace(m, '');
    });
    descriptionText = descriptionText.trim();
    
    let depositsCredits: number | null = null;
    let withdrawalsDebits: number | null = null;

    if (amount > 0) {
        depositsCredits = amount;
    } else {
        withdrawalsDebits = Math.abs(amount);
    }
    
    // Infer type from description for better accuracy than just the sign
    const lowerDesc = descriptionText.toLowerCase();
    if(lowerDesc.includes('zelle from') || lowerDesc.includes('money transfer from') || lowerDesc.includes('deposits/credits')){
        depositsCredits = Math.abs(amount);
        withdrawalsDebits = null;
    } else if (lowerDesc.includes('purchase') || lowerDesc.includes('recurring payment') || lowerDesc.includes('atm withdrawal') || lowerDesc.includes('online transfer to') || lowerDesc.includes('monthly service fee')){
        withdrawalsDebits = Math.abs(amount);
        depositsCredits = null;
    }

    return {
        date: txBlock.date,
        description: descriptionText,
        depositsCredits: depositsCredits,
        withdrawalsDebits: withdrawalsDebits,
        dailyBalance: balance,
    };
};


export const extractTransactionsFromTextInternal = ai.defineFlow(
  {
    name: 'extractTransactionsFromTextInternalFlow',
    inputSchema: ExtractTransactionsFromTextInputSchema,
    outputSchema: ExtractTransactionsOutputSchema,
  },
  async (input): Promise<ExtractTransactionsOutput> => {
    if (!input.pdfText) {
        return { transactions: [] };
    }

    try {
      const { output } = await extractionPrompt(input, { model: textModel });

      if (output && output.transactions.length > 0) {
        console.log(`[AI Extractor] AI successfully extracted ${output.transactions.length} transactions.`);
        return { transactions: output.transactions };
      }
      
      console.log("[AI Extractor] AI returned 0 transactions. Attempting fallback parser for Wells Fargo format.");
      
      const fallbackTransactions = parseWellsFargoText(input.pdfText);

      if (fallbackTransactions.length > 0) {
        return { transactions: fallbackTransactions };
      }

      console.log("[Fallback Parser] Fallback parser also found 0 transactions. Text for debug:", input.pdfText.substring(0, 2000));
      return { transactions: [] };

    } catch (e: any) {
      console.error(`[extractTransactionsFromTextInternalFlow] AI Error: ${e.message}`);
      // In case of error from the AI service, return empty.
      return { transactions: [] };
    }
  }
);
