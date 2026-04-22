// Re-exports — all logic lives in src/lib/parsers/
// Keeping this file so existing imports (reconciliation/page.tsx, etc.) don't break.
export { parsePdfText, parseStatement, stripXEncoding } from './parsers/index';
export type { PdfSummary, ParsedTx } from './parsers/types';

// Individual utilities re-exported for any direct callers
export { checkTextQuality }              from './parsers/normalize';
export { detectBank, detectPeriod,
         detectOpeningEndingBalance,
         detectFees }                    from './parsers/banks';
export { parseAmount }                   from './parsers/extract';
