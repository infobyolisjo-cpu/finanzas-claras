// ── Orchestrator: 4-layer PDF parsing pipeline ───────────────────────────────
//
// Layer 1 — Universal extraction  (extract.ts)
//   pdfjs coordinate-encoded text → RawRows → ColumnMap (X clustering)
//   → ParsedTx[]
//
// Layer 2 — Bank detection  (banks.ts)
//   Identify bank name; attempt bank-specific summary-box override.
//   Wells Fargo has an explicit Account Activity Summary box with exact totals.
//   Chase / BoA / Capital One fall back to Layer 1 cluster result.
//
// Layer 3 — Normalization  (normalize.ts)
//   Aggregate ParsedTx[] → canonical { deposits, withdrawals, fees, net }.
//   Apply quality checks and build user-facing warnings.
//
// Layer 4 — AI analysis  (actions.ts  ← called separately by the UI)
//   The UI sends the PdfSummary JSON (not the PDF) to getAiInsightsAction().
//   This file is not involved in Layer 4; the orchestrator just ensures the
//   JSON sent upward is rich enough for the AI to produce useful insights.

import { stripXEncoding, extractRawRows, detectColumns, extractTransactions, totalsFromCluster } from './extract';
import { detectBank, detectPeriod, detectOpeningEndingBalance, detectFees, tryBankSummary } from './banks';
import { checkTextQuality, sumTransactions, extractTopDescriptions, buildWarning } from './normalize';
import type { PdfSummary, ParsedTx } from './types';

export type { PdfSummary, ParsedTx };
export { stripXEncoding };

// ── Main entry point ──────────────────────────────────────────────────────────

export function parseStatement(encodedText: string): PdfSummary & { error?: string } {
  const plain = stripXEncoding(encodedText);

  // Debug sample — visible in browser DevTools console
  console.log('[pdf-parser] plain text sample (first 1 500 chars):\n', plain.slice(0, 1_500));
  console.log('[pdf-parser] total encoded lines:', encodedText.split('\n').length);

  // ── Quality gate ────────────────────────────────────────────────────────────
  const qualityError = checkTextQuality(plain);
  if (qualityError) {
    return {
      bankName: null, periodStart: null, periodEnd: null,
      totals: { deposits: 0, withdrawals: 0, fees: 0, net: 0 },
      transactionCount: 0, topDescriptions: [], transactions: [],
      error: qualityError,
    };
  }

  // ── Layer 2a: bank + period detection ───────────────────────────────────────
  const bankName = detectBank(plain);
  const period   = detectPeriod(plain);
  console.log('[pdf-parser] bank:', bankName, '| period:', period.periodStart, '→', period.periodEnd);

  // ── Layer 1: extract transactions ───────────────────────────────────────────
  const rows         = extractRawRows(encodedText);
  const cols         = detectColumns(rows);
  const transactions = extractTransactions(rows, cols);
  console.log('[pdf-parser] column method:', cols.method,
    `dep=${cols.depositX?.toFixed(0)} wit=${cols.withdrawalX?.toFixed(0)} bal=${cols.balanceX?.toFixed(0)}`);
  console.log('[pdf-parser] transactions extracted:', transactions.length);

  // ── Layer 3: assemble totals ─────────────────────────────────────────────────
  const fees = detectFees(plain);
  const { opening, ending } = detectOpeningEndingBalance(plain);

  let totals: PdfSummary['totals'];
  let usedFallback = false;
  let expectedCount: number | undefined;

  // Priority 1: bank-specific summary box (most authoritative when available).
  // Requires BOTH deposits AND withdrawals > 0 to prevent returning a half-match.
  const bankSummary = tryBankSummary(bankName, plain);
  if (bankSummary && bankSummary.deposits > 0 && bankSummary.withdrawals > 0) {
    const f = bankSummary.fees || fees;
    totals = {
      deposits:    bankSummary.deposits,
      withdrawals: bankSummary.withdrawals,
      fees:        f,
      net: opening != null && ending != null
        ? Math.round((ending - opening) * 100) / 100
        : Math.round((bankSummary.deposits - bankSummary.withdrawals - f) * 100) / 100,
    };
    expectedCount = bankSummary.expectedCount;
    usedFallback  = false;
    console.log('[pdf-parser] Priority 1 (bank summary box):', totals);

  // Priority 2: X-cluster sums (direct from cluster totals, most accurate for parsed rows).
  } else {
    const clusterTotals = totalsFromCluster(rows, cols);
    if (clusterTotals) {
      totals = {
        ...clusterTotals,
        fees,
        net: opening != null && ending != null
          ? Math.round((ending - opening) * 100) / 100
          : Math.round((clusterTotals.deposits - clusterTotals.withdrawals - fees) * 100) / 100,
      };
      usedFallback = false;
      console.log('[pdf-parser] Priority 2 (X-cluster):', totals);

    // Priority 3: sum extracted transactions (sign-based when column detection failed).
    } else {
      usedFallback = true;
      totals = sumTransactions(transactions, fees, opening, ending);
      console.log('[pdf-parser] Priority 3 (sign-based fallback):', totals);
    }
  }

  // ── Layer 3: quality warnings ────────────────────────────────────────────────
  const transactionCount = transactions.length;
  const { incomplete, parseWarning } = buildWarning(transactionCount, expectedCount, usedFallback);
  const topDescriptions = extractTopDescriptions(transactions);

  console.log('[pdf-parser] final:', { deposits: totals.deposits, withdrawals: totals.withdrawals, transactionCount });

  return {
    bankName,
    ...period,
    totals,
    transactionCount,
    expectedCount,
    topDescriptions,
    transactions,
    parseWarning,
    incomplete,
  };
}

// Backwards-compatible alias — existing code imports parsePdfText from pdf-parser.ts
export { parseStatement as parsePdfText };
