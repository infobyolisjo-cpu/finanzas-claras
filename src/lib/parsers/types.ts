// ── Shared types for the multi-layer PDF parser ──────────────────────────────

/** One text item from pdfjs, with its horizontal PDF coordinate. */
export type RawCell = { x: number; str: string };

/** A visual row reconstructed from pdfjs items sharing the same Y coordinate. */
export type RawRow = { cells: RawCell[] };

/**
 * Result of column detection.
 * Positions are cluster centers (X pt) or null when a column wasn't detected.
 * method:
 *   'cluster' — positions derived from gap-based clustering of amount X coords
 *   'none'    — not enough data; fallback heuristics used
 */
export type ColumnMap = {
  depositX:    number | null;
  withdrawalX: number | null;
  balanceX:    number | null;
  method: 'cluster' | 'none';
};

/** A single normalised transaction extracted from the statement. */
export type ParsedTx = {
  date:        string;
  description: string;
  amount:      number;   // always positive
  type:        'income' | 'expense';
  balance?:    number;
};

/**
 * Full structured result returned by parseStatement().
 * The `totals` field uses the legacy deposits/withdrawals naming so the
 * existing UI and AI action work without changes.
 */
export type PdfSummary = {
  bankName:         string | null;
  periodStart:      string | null;
  periodEnd:        string | null;
  totals: {
    deposits:    number;   // = income
    withdrawals: number;   // = expenses
    fees:        number;
    net:         number;
  };
  transactionCount:  number;
  expectedCount?:    number;
  topDescriptions:   string[];
  transactions:      ParsedTx[];
  parseWarning?:     string;
  incomplete?:       boolean;
  error?:            string;
};
