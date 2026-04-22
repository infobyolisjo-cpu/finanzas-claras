// Layer 1: PDF text parsing — no AI required.
// Input: coordinate-reconstructed tab-separated rows (one row per line, tabs between columns).

export type PdfSummary = {
  bankName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  totals: {
    deposits: number;
    withdrawals: number;
    fees: number;
    net: number;
  };
  transactionCount: number;   // lines detected in transaction section
  expectedCount?: number;     // declared in account summary (e.g. WF "X items")
  topDescriptions: string[];
  parseWarning?: string;
  incomplete?: boolean;       // true when detected << expected
};

// ── Debug logger ─────────────────────────────────────────────────────────────

function dbg(...args: any[]) {
  if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_PDF === '1') {
    console.log('[pdf-parser]', ...args);
  }
}

// ── Scanned-PDF guard ────────────────────────────────────────────────────────

export function checkTextQuality(text: string): string | null {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  dbg('text length:', collapsed.length, 'chars');
  if (collapsed.length < 150) {
    return 'Este PDF parece estar escaneado como imagen y no contiene texto extraíble. Descarga el estado de cuenta en formato digital (PDF nativo) desde la banca en línea, o usa el archivo CSV/XLSX si tu banco lo ofrece.';
  }
  return null;
}

// ── Bank detection ───────────────────────────────────────────────────────────

const BANK_PATTERNS: { patterns: string[]; name: string }[] = [
  { patterns: ['WELLS FARGO'], name: 'Wells Fargo' },
  { patterns: ['CHASE', 'JPMORGAN'], name: 'Chase' },
  { patterns: ['BANK OF AMERICA', 'BANKOFAMERICA'], name: 'Bank of America' },
  { patterns: ['CITIBANK', 'CITI BANK'], name: 'Citibank' },
  { patterns: ['US BANK', 'USBANK'], name: 'US Bank' },
  { patterns: ['CAPITAL ONE'], name: 'Capital One' },
  { patterns: ['BBVA', 'BANCOMER'], name: 'BBVA' },
  { patterns: ['SANTANDER'], name: 'Santander' },
  { patterns: ['BANAMEX', 'CITIBANAMEX', 'CITI BANAMEX'], name: 'Citibanamex' },
  { patterns: ['BANORTE'], name: 'Banorte' },
  { patterns: ['HSBC'], name: 'HSBC' },
  { patterns: ['INBURSA'], name: 'Inbursa' },
  { patterns: ['SCOTIABANK'], name: 'Scotiabank' },
  { patterns: ['BANCO AZTECA', 'AZTECA'], name: 'Banco Azteca' },
  { patterns: ['BANBAJIO', 'BAN BAJIO'], name: 'BanBajío' },
  { patterns: ['AFIRME'], name: 'Afirme' },
  { patterns: ['NU BANK', 'NUBANK', 'NU MEXICO', 'NU MÉXICO'], name: 'Nu' },
  { patterns: ['MERCADO PAGO', 'MERCADOPAGO'], name: 'Mercado Pago' },
  { patterns: ['AMERICAN EXPRESS', 'AMEX'], name: 'American Express' },
  { patterns: ['INTERCAM'], name: 'Intercam' },
  { patterns: ['MIFEL'], name: 'Mifel' },
];

export function detectBank(text: string): string | null {
  const upper = text.toUpperCase().slice(0, 5000);
  for (const b of BANK_PATTERNS) {
    if (b.patterns.some((p) => upper.includes(p))) return b.name;
  }
  return null;
}

// ── Amount parsing ───────────────────────────────────────────────────────────

export function parseAmount(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const isNegParen = s.startsWith('(') && s.endsWith(')');
  const clean = s.replace(/[$()€£\s]/g, '').replace(/,/g, '');
  const n = parseFloat(clean);
  if (!isFinite(n) || isNaN(n)) return null;
  return isNegParen ? -Math.abs(n) : n;
}

function firstAmount(str: string): number | null {
  const m = str.match(/[-−]?\$?\s*[\d,]+\.\d{2}/);
  return m ? parseAmount(m[0]) : null;
}

// ── Period detection ─────────────────────────────────────────────────────────

const SPANISH_MONTHS: Record<string, string> = {
  ENERO:'01',FEBRERO:'02',MARZO:'03',ABRIL:'04',MAYO:'05',JUNIO:'06',
  JULIO:'07',AGOSTO:'08',SEPTIEMBRE:'09',OCTUBRE:'10',NOVIEMBRE:'11',DICIEMBRE:'12',
  ENE:'01',FEB:'02',MAR:'03',ABR:'04',MAY:'05',JUN:'06',
  JUL:'07',AGO:'08',SEP:'09',OCT:'10',NOV:'11',DIC:'12',
};
const ENGLISH_MONTHS: Record<string, string> = {
  JANUARY:'01',FEBRUARY:'02',MARCH:'03',APRIL:'04',MAY:'05',JUNE:'06',
  JULY:'07',AUGUST:'08',SEPTEMBER:'09',OCTOBER:'10',NOVEMBER:'11',DECEMBER:'12',
  JAN:'01',FEB:'02',MAR:'03',APR:'04',JUN:'06',
  JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12',
};

export function detectPeriod(text: string): { periodStart: string | null; periodEnd: string | null } {
  let m: RegExpExecArray | null;

  // Wells Fargo / Chase: "Opening/Closing date  03/01/2026 - 03/31/2026"
  //  or "Statement period 03/01/2026 to 03/31/2026"
  const wfPeriod = /(?:opening\/closing\s+date|statement\s+period|account\s+period|period)[:\s\t]+(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–—to\t]+\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(text);
  if (wfPeriod) return { periodStart: wfPeriod[1], periodEnd: wfPeriod[2] };

  // Plain MM/DD/YYYY range: "03/01/2026 - 03/31/2026"
  const slashRange = /(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–—]\s*(\d{1,2}\/\d{1,2}\/\d{4})/.exec(text);
  if (slashRange) return { periodStart: slashRange[1], periodEnd: slashRange[2] };

  // "January 1, 2024 – January 31, 2024"
  const upper = text.toUpperCase();
  const engRange = /([A-Z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?\s*[-–—TO]+\s*([A-Z]+)\s+(\d{1,2}),?\s+(\d{4})/i.exec(upper);
  if (engRange) {
    const m1 = ENGLISH_MONTHS[engRange[1]], m2 = ENGLISH_MONTHS[engRange[4]], yr = engRange[6];
    if (m1 && m2) return {
      periodStart: `${engRange[2].padStart(2,'0')}/${m1}/${engRange[3]??yr}`,
      periodEnd:   `${engRange[5].padStart(2,'0')}/${m2}/${yr}`,
    };
  }

  // Spanish "DD de MES YYYY ... DD de MES YYYY"
  const spanRe = /(\d{1,2})\s+DE\s+(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+(?:DE\s+)?(\d{4})/gi;
  const spanDates: string[] = [];
  while ((m = spanRe.exec(upper)) !== null && spanDates.length < 2) {
    const mo = SPANISH_MONTHS[m[2]];
    if (mo) spanDates.push(`${m[1].padStart(2,'0')}/${mo}/${m[3]}`);
  }
  if (spanDates.length >= 2) return { periodStart: spanDates[0], periodEnd: spanDates[spanDates.length-1] };
  if (spanDates.length === 1) return { periodStart: spanDates[0], periodEnd: null };

  // ISO YYYY-MM-DD
  const isoRe = /(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))/g;
  const isoDates: string[] = [];
  while ((m = isoRe.exec(text)) !== null && isoDates.length < 2) isoDates.push(m[1]);
  if (isoDates.length >= 2) return { periodStart: isoDates[0], periodEnd: isoDates[isoDates.length-1] };

  return { periodStart: null, periodEnd: null };
}

// ── Wells Fargo Account Summary box ─────────────────────────────────────────
// Format: "Deposits/Credits  3 items, plus  $5,100.00"
//         "Withdrawals/Debits 25 items, less $3,456.78"
//         "Service charges/Fees 0 transaction(s), less $0.00"

type WfSummary = {
  deposits: number; depositsCount: number;
  withdrawals: number; withdrawalsCount: number;
  fees: number; feesCount: number;
};

export function parseWellsFargoSummary(text: string): WfSummary | null {
  // WF statements use a two-column header layout, so the flat-join approach
  // interleaves left-column address text between labels and amounts.
  // Instead: scan line-by-line; for each label line, search a 4-line window
  // (label line + next 3 lines, collapsed) for the count and amount.
  const lines = text.split('\n');

  const DEP_LABEL  = /deposits?\s*[/]\s*credits?/i;
  const WIT_LABEL  = /withdrawals?\s*[/]\s*debits?/i;
  const FEE_LABEL  = /service\s+charges?\s*[/]?\s*fees?/i;

  const COUNT_RE   = /(\d+)\s+(?:items?|transactions?(?:\(?s?\))?)/i;
  const PLUS_RE    = /(?:plus|[+])\s*\$?\s*([\d,]+\.?\d*)/i;
  const LESS_RE    = /(?:less|[-])\s*\$?\s*([\d,]+\.?\d*)/i;

  let deposits = 0, depositsCount = 0;
  let withdrawals = 0, withdrawalsCount = 0;
  let fees = 0, feesCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Collapse the current line's tabs to spaces for label detection
    const lineFlat = line.replace(/\s+/g, ' ');
    // Window = this line + next 3 lines (handles amounts on following lines)
    const win = lines.slice(i, Math.min(i + 4, lines.length)).join(' ').replace(/\s+/g, ' ');

    // Only fire each block when the CURRENT LINE contains the label.
    // This avoids cross-contamination between adjacent summary rows.
    if (DEP_LABEL.test(lineFlat)) {
      const cm = COUNT_RE.exec(win); const am = PLUS_RE.exec(win);
      if (cm) depositsCount = parseInt(cm[1]);
      if (am) deposits = parseAmount(am[1]) ?? 0;
      dbg('WF deposits →', deposits, depositsCount);
    }

    if (WIT_LABEL.test(lineFlat)) {
      const cm = COUNT_RE.exec(win); const am = LESS_RE.exec(win);
      if (cm) withdrawalsCount = parseInt(cm[1]);
      if (am) withdrawals = parseAmount(am[1]) ?? 0;
      dbg('WF withdrawals →', withdrawals, withdrawalsCount);
    }

    if (FEE_LABEL.test(lineFlat)) {
      const cm = COUNT_RE.exec(win); const am = LESS_RE.exec(win);
      if (cm) feesCount = parseInt(cm[1]);
      if (am) fees = parseAmount(am[1]) ?? 0;
      dbg('WF fees →', fees, feesCount);
    }
  }

  if (deposits === 0 && withdrawals === 0) return null;
  return { deposits, depositsCount, withdrawals, withdrawalsCount, fees, feesCount };
}

// ── Opening / Ending balance detector ───────────────────────────────────────
// WF format: "Opening balance on 03/01/2026  $5,100.00"
//            "Ending balance on 03/31/2026  $6,730.22"

export function detectOpeningEndingBalance(text: string): { opening: number | null; ending: number | null } {
  const OPEN_RE  = /opening\s+balance[^\d$]*([\d,]+\.\d{2})/i;
  const CLOSE_RE = /ending\s+balance[^\d$]*([\d,]+\.\d{2})/i;
  const openM  = OPEN_RE.exec(text);
  const closeM = CLOSE_RE.exec(text);
  return {
    opening: openM  ? (parseAmount(openM[1])  ?? null) : null,
    ending:  closeM ? (parseAmount(closeM[1]) ?? null) : null,
  };
}

// ── Generic labeled totals (English + Spanish) ───────────────────────────────

const DEPOSIT_LABELS = [
  'TOTAL DEPOSITS','TOTAL CREDITS','DEPOSITS AND OTHER CREDITS',
  'TOTAL ADDITIONS','TOTAL MONEY IN',
  'TOTAL ABONOS','TOTAL DEPOSITOS','TOTAL DEPÓSITOS',
  'TOTAL CREDITOS','TOTAL CRÉDITOS','TOTAL INGRESOS',
  'ABONOS DEL PERIODO','ABONOS DEL PERÍODO','SUMA DE DEPOSITOS','SUMA DE CRÉDITOS',
];
const WITHDRAWAL_LABELS = [
  'TOTAL WITHDRAWALS','TOTAL DEBITS','WITHDRAWALS AND OTHER DEBITS',
  'TOTAL SUBTRACTIONS','TOTAL MONEY OUT','TOTAL CHECKS AND PAYMENTS',
  'TOTAL CARGOS','TOTAL RETIROS','TOTAL DEBITOS','TOTAL DÉBITOS',
  'TOTAL EGRESOS','CARGOS DEL PERIODO','CARGOS DEL PERÍODO',
  'SUMA DE CARGOS','SUMA DE RETIROS',
];
const FEE_LABELS = [
  'TOTAL SERVICE CHARGES','TOTAL FEES','SERVICE FEE',
  'TOTAL COMISIONES','COMISIONES DEL PERIODO','CARGOS POR SERVICIO',
];

function findLabeledAmount(text: string, labels: string[]): number {
  const upper = text.toUpperCase();
  for (const label of labels) {
    const idx = upper.indexOf(label);
    if (idx === -1) continue;
    const near = text.slice(idx + label.length, idx + label.length + 200);
    const m = near.match(/\$?\s*[\d,]+\.?\d{0,2}/);
    if (m) {
      const n = parseAmount(m[0]);
      if (n !== null && n > 0) return n;
    }
  }
  return 0;
}

// ── Transaction section parser ───────────────────────────────────────────────
// Works on coordinate-extracted tab-separated rows.
// Handles Wells Fargo "M/D" date format and generic "MM/DD/YYYY" dates.

type TxRow = { date: string; description: string; amounts: number[] };

const TX_DATE_RE = /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/;

function isTxLine(line: string): boolean {
  return TX_DATE_RE.test(line.trim()) && /\$?\s*[\d,]+\.\d{2}/.test(line);
}

function parseTxRow(line: string): TxRow | null {
  const cols = line.split('\t').map(c => c.trim());
  if (!cols.length) return null;
  const dateM = TX_DATE_RE.exec(cols[0]);
  if (!dateM) return null;

  const description = cols.slice(1).filter(c => c && !/^[\d,.\$]+$/.test(c)).join(' ').slice(0, 80);
  const amounts: number[] = [];
  for (const col of cols.slice(1)) {
    const n = parseAmount(col);
    if (n !== null && Math.abs(n) >= 0.01 && Math.abs(n) <= 9_999_999) amounts.push(n);
  }

  return { date: dateM[1], description, amounts };
}

// ── Totals assembly ──────────────────────────────────────────────────────────

export function parseTotals(text: string): {
  result: PdfSummary['totals'];
  expectedCount?: number;
  usedFallback: boolean;
} {
  // Priority 1: Wells Fargo Account Summary box (exact, declared by bank)
  const wf = parseWellsFargoSummary(text);
  if (wf && (wf.deposits > 0 || wf.withdrawals > 0)) {
    const deposits    = wf.deposits;
    const withdrawals = wf.withdrawals;
    const fees        = wf.fees;
    return {
      usedFallback: false,
      expectedCount: wf.depositsCount + wf.withdrawalsCount + wf.feesCount,
      result: {
        deposits,
        withdrawals,
        fees,
        net: Math.round((deposits - withdrawals - fees) * 100) / 100,
      },
    };
  }

  // Priority 2: Generic labeled totals (English + Spanish)
  let deposits    = findLabeledAmount(text, DEPOSIT_LABELS);
  let withdrawals = findLabeledAmount(text, WITHDRAWAL_LABELS);
  const fees      = findLabeledAmount(text, FEE_LABELS);

  if (deposits > 0 || withdrawals > 0) {
    dbg('generic labeled totals →', deposits, withdrawals, fees);
    return {
      usedFallback: false,
      result: {
        deposits,
        withdrawals,
        fees,
        net: Math.round((deposits - withdrawals - fees) * 100) / 100,
      },
    };
  }

  // Priority 3: Heuristic — scan individual transaction lines
  dbg('falling back to heuristic line scan');
  const SKIP = ['FECHA','SALDO','TOTAL','CONCEPTO','DATE','BALANCE','DESCRIPTION',
                'BEGINNING','ENDING','SUMMARY','OPENING','CLOSING'];

  const rows: TxRow[] = [];
  for (const line of text.split('\n')) {
    if (!isTxLine(line)) continue;
    const upper = line.toUpperCase();
    if (SKIP.some(w => upper.includes(w))) continue;
    const row = parseTxRow(line);
    if (row) rows.push(row);
  }

  dbg('heuristic: transaction rows found:', rows.length);

  // For WF: in each tx row, the LAST amount is the running balance (skip it),
  // the second-to-last (if exists) is the tx amount.
  for (const row of rows) {
    if (row.amounts.length === 0) continue;
    // Only one amount visible → could be tx amount (not balance) — treat as unsigned
    // Two amounts → first is tx, last is balance
    const txAmt = row.amounts.length >= 2 ? row.amounts[0] : row.amounts[0];
    if (txAmt > 0) deposits += txAmt;
    else withdrawals += Math.abs(txAmt);
  }

  deposits    = Math.round(deposits    * 100) / 100;
  withdrawals = Math.round(withdrawals * 100) / 100;
  dbg('heuristic totals →', deposits, withdrawals);

  // Priority 4: Opening / Ending balance difference for net (best-effort)
  const { opening, ending } = detectOpeningEndingBalance(text);
  if (opening !== null && ending !== null) {
    const net = Math.round((ending - opening) * 100) / 100;
    dbg('balance fallback net →', net, 'opening:', opening, 'ending:', ending);
    // We still can't split deposits vs withdrawals, but at least net is accurate
    return {
      usedFallback: true,
      result: { deposits, withdrawals, fees, net },
    };
  }

  return {
    usedFallback: true,
    result: {
      deposits,
      withdrawals,
      fees,
      net: Math.round((deposits - withdrawals - fees) * 100) / 100,
    },
  };
}

// ── Transaction count ────────────────────────────────────────────────────────

export function countTransactions(text: string): number {
  const SKIP_UPPER = ['TOTAL','BALANCE','BEGINNING','ENDING','OPENING','CLOSING','SUMMARY'];
  let count = 0;
  for (const line of text.split('\n')) {
    if (!isTxLine(line)) continue;
    const upper = line.toUpperCase();
    if (SKIP_UPPER.some(w => upper.includes(w))) continue;
    count++;
  }
  dbg('transaction lines counted:', count);
  return count;
}

// ── Top merchant descriptions ────────────────────────────────────────────────

export function extractTopDescriptions(text: string, limit = 8): string[] {
  const counts: Record<string, number> = {};
  for (const line of text.split('\n')) {
    if (!isTxLine(line)) continue;
    const row = parseTxRow(line);
    if (!row || row.description.length < 4) continue;
    counts[row.description] = (counts[row.description] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort(([,a],[,b]) => b - a)
    .slice(0, limit)
    .map(([d]) => d);
}

// ── Completeness validation ──────────────────────────────────────────────────

function buildWarning(
  detected: number,
  expected: number | undefined,
  usedFallback: boolean,
): { incomplete: boolean; parseWarning?: string } {
  // 1. Compare against declared count from account summary
  if (expected !== undefined && expected > 0) {
    if (detected < expected * 0.6) {
      return {
        incomplete: true,
        parseWarning:
          `Solo se detectaron ${detected} de ${expected} movimientos declarados en el resumen del banco. ` +
          `El PDF podría estar protegido o tener un layout de múltiples columnas que dificulta la extracción. ` +
          `Para mayor precisión descarga el archivo en formato CSV o Excel desde tu banco.`,
      };
    }
    return { incomplete: false };
  }

  // 2. Heuristic: monthly period with very few lines
  if (usedFallback && detected < 5) {
    return {
      incomplete: true,
      parseWarning:
        `Solo se detectaron ${detected} movimiento(s). Si el estado de cuenta es mensual esto parece incompleto. ` +
        `Este PDF podría requerir OCR o descarga en formato CSV/XLSX para un análisis completo.`,
    };
  }

  // 3. Totals used fallback but count seems OK
  if (usedFallback) {
    return {
      incomplete: false,
      parseWarning:
        `Los totales se estimaron a partir de los movimientos detectados — no se encontró un cuadro de resumen estructurado. ` +
        `Verifica los montos contra tu estado de cuenta original.`,
    };
  }

  return { incomplete: false };
}

// ── Main entry point ─────────────────────────────────────────────────────────

export function parsePdfText(text: string): PdfSummary & { error?: string } {
  // Always log first 1500 chars so devs can inspect coordinate-extracted text in browser console
  console.log('[pdf-parser] extracted text sample (first 1500 chars):\n', text.slice(0, 1500));
  console.log('[pdf-parser] total lines:', text.split('\n').length);

  const qualityError = checkTextQuality(text);
  if (qualityError) {
    return {
      bankName: null, periodStart: null, periodEnd: null,
      totals: { deposits: 0, withdrawals: 0, fees: 0, net: 0 },
      transactionCount: 0, topDescriptions: [],
      error: qualityError,
    };
  }

  const { result: totals, expectedCount, usedFallback } = parseTotals(text);
  const transactionCount = countTransactions(text);

  const { incomplete, parseWarning } = buildWarning(transactionCount, expectedCount, usedFallback);

  dbg('final summary →', { totals, transactionCount, expectedCount, incomplete });

  return {
    bankName: detectBank(text),
    ...detectPeriod(text),
    totals,
    transactionCount,
    expectedCount,
    topDescriptions: extractTopDescriptions(text),
    parseWarning,
    incomplete,
  };
}
