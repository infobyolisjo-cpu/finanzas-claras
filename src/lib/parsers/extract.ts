// ── Layer 1: Universal extraction ────────────────────────────────────────────
// Input:  "@X:content\t@X:content\n…" — coordinate-encoded rows from pdfjs
// Output: RawRow[], ColumnMap, ParsedTx[]
//
// Column detection is purely data-driven (gap-based X clustering).
// No bank-specific rules or hardcoded X ranges.

import type { RawCell, RawRow, ColumnMap, ParsedTx } from './types';

// ── Encoding utilities ────────────────────────────────────────────────────────

export function stripXEncoding(text: string): string {
  return text.replace(/@\d+:/g, '');
}

export function parseCells(line: string): RawCell[] {
  return line.split('\t').flatMap(cell => {
    const m = /^@(\d+):(.*)$/.exec(cell);
    const c = m ? { x: parseInt(m[1]), str: m[2] } : { x: 0, str: cell };
    return c.str.trim().length > 0 ? [c] : [];
  });
}

export function extractRawRows(encodedText: string): RawRow[] {
  return encodedText
    .split('\n')
    .map(line => ({ cells: parseCells(line) }))
    .filter(r => r.cells.length > 0);
}

// ── Amount parsing ────────────────────────────────────────────────────────────

export function parseAmount(raw: string): number | null {
  const s = raw.trim();
  if (!s || !s.includes('.')) return null;
  const isNegParen = s.startsWith('(') && s.endsWith(')');
  const clean = s.replace(/[$()€£\s]/g, '').replace(/,/g, '');
  const n = parseFloat(clean);
  if (!isFinite(n) || isNaN(n)) return null;
  return isNegParen ? -Math.abs(n) : n;
}

// ── Column detection ──────────────────────────────────────────────────────────

const TX_DATE_RE = /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/;
const SKIP       = ['TOTAL','BALANCE','BEGINNING','ENDING','SUMMARY','OPENING','CLOSING'];

/**
 * Gap-based X clustering.
 *
 * Collects all decimal amounts from date-starting rows, groups their X
 * positions by proximity (gap > GAP_PT = different column), then assigns:
 *   rightmost cluster           → balance (running total, present in every row)
 *   second-rightmost tx cluster → withdrawals/debits
 *   third-rightmost  tx cluster → deposits/credits
 *
 * This is purely data-driven — works for any bank that uses a standard
 * Date | Description | Credit | Debit | Balance column layout.
 */
export function detectColumns(rows: RawRow[]): ColumnMap {
  const GAP_PT = 30;

  type Pt = { x: number; amount: number };
  const pts: Pt[] = [];

  for (const row of rows) {
    if (row.cells.length < 2) continue;
    if (!TX_DATE_RE.test(row.cells[0].str.trim())) continue;
    if (SKIP.some(w => row.cells.map(c => c.str).join(' ').toUpperCase().includes(w))) continue;

    for (const cell of row.cells.slice(1)) {
      if (!cell.str.includes('.')) continue;
      const n = parseAmount(cell.str);
      if (n === null || n < 0.01 || n > 9_999_999) continue;
      pts.push({ x: cell.x, amount: n });
      console.log(`[pdf-cluster] x=${cell.x} $${n} row="${row.cells[0].str.trim()}"`);
    }
  }

  console.log(`[pdf-cluster] ${pts.length} numeric cells collected`);
  if (pts.length < 5) return { depositX: null, withdrawalX: null, balanceX: null, method: 'none' };

  // Group unique X values into clusters separated by GAP_PT
  const uniqueX = [...new Set(pts.map(p => p.x))].sort((a, b) => a - b);
  const groups: number[][] = [[uniqueX[0]]];
  for (let i = 1; i < uniqueX.length; i++) {
    if (uniqueX[i] - uniqueX[i - 1] > GAP_PT) groups.push([]);
    groups[groups.length - 1].push(uniqueX[i]);
  }

  // Cluster centers (mean X within each group)
  const clusters = groups.map(g => ({
    center: g.reduce((a, b) => a + b, 0) / g.length,
    count:  0,
    total:  0,
  }));

  for (const pt of pts) {
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      const d = Math.abs(pt.x - clusters[i].center);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    clusters[best].count++;
    clusters[best].total += pt.amount;
  }

  console.log('[pdf-cluster] clusters:', clusters.map((c, i) =>
    `[${i}] x≈${Math.round(c.center)} n=${c.count} sum=$${c.total.toFixed(2)}`
  ).join(' | '));

  if (clusters.length < 3) {
    console.log('[pdf-cluster] fewer than 3 clusters — cannot separate all columns');
    // 2 clusters: treat leftmost as expenses, rightmost as balance
    if (clusters.length === 2) {
      return {
        depositX:    null,
        withdrawalX: clusters[0].center,
        balanceX:    clusters[1].center,
        method: 'cluster',
      };
    }
    return { depositX: null, withdrawalX: null, balanceX: null, method: 'none' };
  }

  // Rightmost cluster = balance (skip)
  const balIdx = clusters.length - 1;

  // Among remaining, take the 2 rightmost → withdrawals then deposits
  // (any far-left noise clusters from description text are auto-skipped)
  const txClusters = clusters
    .map((c, i) => ({ ...c, i }))
    .filter(c => c.i !== balIdx)
    .sort((a, b) => a.center - b.center);

  if (txClusters.length < 2) {
    console.log('[pdf-cluster] only 1 tx cluster after excluding balance');
    return { depositX: null, withdrawalX: null, balanceX: null, method: 'none' };
  }

  const depCluster = txClusters[txClusters.length - 2]; // deposits left of withdrawals
  const witCluster = txClusters[txClusters.length - 1]; // rightmost non-balance

  console.log(`[pdf-cluster] deposits  [${depCluster.i}] x≈${Math.round(depCluster.center)} → $${depCluster.total.toFixed(2)}`);
  console.log(`[pdf-cluster] withdrawals [${witCluster.i}] x≈${Math.round(witCluster.center)} → $${witCluster.total.toFixed(2)}`);
  console.log(`[pdf-cluster] balance   [${balIdx}]         x≈${Math.round(clusters[balIdx].center)}`);

  return {
    depositX:    depCluster.center,
    withdrawalX: witCluster.center,
    balanceX:    clusters[balIdx].center,
    method: 'cluster',
  };
}

// ── Amount classification ─────────────────────────────────────────────────────

function classifyAmount(x: number, cols: ColumnMap): 'income' | 'expense' | 'balance' | 'skip' {
  const { depositX, withdrawalX, balanceX } = cols;

  if (depositX === null || withdrawalX === null) {
    // Only balance/expense known
    if (balanceX !== null && x > balanceX - 20) return 'balance';
    return 'expense';
  }

  // Cluster centers → midpoint thresholds
  const midDW = (depositX + withdrawalX) / 2;
  const midWB = balanceX !== null ? (withdrawalX + balanceX) / 2 : withdrawalX + 50;

  if (x >= midWB) return 'balance';
  if (x >= midDW) return 'expense';

  // Guard: skip amounts far to the left of the deposit cluster (description noise)
  const halfGap = (withdrawalX - depositX) / 2;
  if (x < depositX - halfGap) return 'skip';

  return 'income';
}

// ── Transaction extraction ────────────────────────────────────────────────────

export function extractTransactions(rows: RawRow[], cols: ColumnMap): ParsedTx[] {
  const txs: ParsedTx[] = [];

  for (const row of rows) {
    if (row.cells.length < 2) continue;
    const dateMatch = TX_DATE_RE.exec(row.cells[0].str.trim());
    if (!dateMatch) continue;
    if (SKIP.some(w => row.cells.map(c => c.str).join(' ').toUpperCase().includes(w))) continue;

    const date = dateMatch[1];

    const description = row.cells.slice(1)
      .filter(c => !/^[\d,.$()]+$/.test(c.str.trim()) && c.str.trim().length > 0)
      .map(c => c.str.trim())
      .join(' ')
      .slice(0, 80);

    let income = 0, expense = 0, balance: number | undefined;

    for (const cell of row.cells.slice(1)) {
      if (!cell.str.includes('.')) continue;
      const n = parseAmount(cell.str);
      if (n === null || Math.abs(n) < 0.01 || Math.abs(n) > 9_999_999) continue;
      const abs = Math.abs(n);

      if (cols.method === 'none') {
        // Sign-based fallback when no column info available
        if (n > 0) income  += n;
        else       expense += abs;
        continue;
      }

      switch (classifyAmount(cell.x, cols)) {
        case 'income':  income  += abs; break;
        case 'expense': expense += abs; break;
        case 'balance': balance  = abs; break;
        // 'skip': description-area noise → ignore
      }
    }

    if (income > 0)  txs.push({ date, description, amount: income,  type: 'income',  balance });
    if (expense > 0) txs.push({ date, description, amount: expense, type: 'expense', balance });
  }

  return txs;
}

// ── Totals directly from cluster sums ────────────────────────────────────────
// Faster path: instead of re-summing transactions, read totals straight
// from the cluster totals computed during detectColumns.
// This is used by the orchestrator as Priority 2 when column detection succeeded.

export function totalsFromCluster(rows: RawRow[], cols: ColumnMap): {
  deposits: number; withdrawals: number;
} | null {
  if (cols.method === 'none' || cols.depositX === null || cols.withdrawalX === null) return null;

  let deposits = 0, withdrawals = 0;

  for (const row of rows) {
    if (row.cells.length < 2) continue;
    if (!TX_DATE_RE.test(row.cells[0].str.trim())) continue;
    if (SKIP.some(w => row.cells.map(c => c.str).join(' ').toUpperCase().includes(w))) continue;

    for (const cell of row.cells.slice(1)) {
      if (!cell.str.includes('.')) continue;
      const n = parseAmount(cell.str);
      if (n === null || n < 0.01 || n > 9_999_999) continue;
      switch (classifyAmount(cell.x, cols)) {
        case 'income':  deposits    += n; break;
        case 'expense': withdrawals += n; break;
      }
    }
  }

  if (deposits === 0 && withdrawals === 0) return null;
  return {
    deposits:    Math.round(deposits    * 100) / 100,
    withdrawals: Math.round(withdrawals * 100) / 100,
  };
}
