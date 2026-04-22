// Layer 1: PDF text parsing — no AI required.
// Works with imperfect/unstructured PDFs (Wells Fargo, BBVA, Santander, etc.)

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
  transactionCount: number;
  topDescriptions: string[];
  parseWarning?: string; // set when parsing fell back to heuristics
};

// ── Debug logger (no-op in production unless DEBUG_PDF=1) ───────────────────

function dbg(...args: any[]) {
  if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_PDF === '1') {
    console.log('[pdf-parser]', ...args);
  }
}

// ── Scanned-PDF guard ────────────────────────────────────────────────────────

export function checkTextQuality(text: string): string | null {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  dbg(`text length: ${trimmed.length} chars`);
  if (trimmed.length < 100) {
    return 'El PDF parece estar escaneado como imagen y no contiene texto extraíble. Descarga el estado de cuenta en formato digital desde la banca en línea.';
  }
  return null;
}

// ── Bank detection ───────────────────────────────────────────────────────────

const BANK_PATTERNS: { patterns: string[]; name: string }[] = [
  { patterns: ['WELLS FARGO'], name: 'Wells Fargo' },
  { patterns: ['CHASE', 'JPMORGAN'], name: 'Chase' },
  { patterns: ['BANK OF AMERICA', 'BANKOFAMERICA'], name: 'Bank of America' },
  { patterns: ['CITIBANK', 'CITI BANK'], name: 'Citibank' },
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
  { patterns: ['US BANK', 'USBANK'], name: 'US Bank' },
  { patterns: ['CAPITAL ONE'], name: 'Capital One' },
];

export function detectBank(text: string): string | null {
  const upper = text.toUpperCase().slice(0, 4000);
  for (const bank of BANK_PATTERNS) {
    if (bank.patterns.some((p) => upper.includes(p))) return bank.name;
  }
  return null;
}

// ── Period detection ─────────────────────────────────────────────────────────

const SPANISH_MONTHS: Record<string, string> = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04',
  MAYO: '05', JUNIO: '06', JULIO: '07', AGOSTO: '08',
  SEPTIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12',
  ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06',
  JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

const ENGLISH_MONTHS: Record<string, string> = {
  JANUARY: '01', FEBRUARY: '02', MARCH: '03', APRIL: '04',
  MAY: '05', JUNE: '06', JULY: '07', AUGUST: '08',
  SEPTEMBER: '09', OCTOBER: '10', NOVEMBER: '11', DECEMBER: '12',
  JAN: '01', FEB: '02', MAR: '03', APR: '04', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

export function detectPeriod(text: string): { periodStart: string | null; periodEnd: string | null } {
  const upper = text.toUpperCase();
  let m: RegExpExecArray | null;

  // "Statement Period: MM/DD/YYYY - MM/DD/YYYY" (Wells Fargo / Chase style)
  const wfPeriod = /(?:STATEMENT\s+PERIOD|ACCOUNT\s+PERIOD|PERIOD)[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–TO]+\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(text);
  if (wfPeriod) return { periodStart: wfPeriod[1], periodEnd: wfPeriod[2] };

  // "January 1, 2024 - January 31, 2024" or "January 1 - January 31, 2024"
  const englishRange = /([A-Z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?\s*[-–TO]+\s*([A-Z]+)\s+(\d{1,2}),?\s+(\d{4})/i.exec(upper);
  if (englishRange) {
    const m1 = ENGLISH_MONTHS[englishRange[1]];
    const m2 = ENGLISH_MONTHS[englishRange[4]];
    const year = englishRange[6];
    if (m1 && m2) {
      return {
        periodStart: `${englishRange[2].padStart(2, '0')}/${m1}/${englishRange[3] ?? year}`,
        periodEnd: `${englishRange[5].padStart(2, '0')}/${m2}/${year}`,
      };
    }
  }

  // DD/MM/YYYY AL DD/MM/YYYY (Spanish range)
  const rangeSlash = /(\d{1,2}\/\d{1,2}\/\d{4})\s*(?:AL|-|A)\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(text);
  if (rangeSlash) return { periodStart: rangeSlash[1], periodEnd: rangeSlash[2] };

  // "Del DD de MES YYYY al DD de MES YYYY"
  const spanishRegex = /(\d{1,2})\s+DE\s+(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+(?:DE\s+)?(\d{4})/gi;
  const spanishDates: string[] = [];
  while ((m = spanishRegex.exec(upper)) !== null && spanishDates.length < 2) {
    const mo = SPANISH_MONTHS[m[2]];
    if (mo) spanishDates.push(`${m[1].padStart(2, '0')}/${mo}/${m[3]}`);
  }
  if (spanishDates.length >= 2) return { periodStart: spanishDates[0], periodEnd: spanishDates[spanishDates.length - 1] };
  if (spanishDates.length === 1) return { periodStart: spanishDates[0], periodEnd: null };

  // DD-MMM-YYYY
  const shortMonthRegex = /(\d{1,2})[-\/](ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)[-\/](\d{4})/gi;
  const shortDates: string[] = [];
  while ((m = shortMonthRegex.exec(upper)) !== null && shortDates.length < 2) {
    const mo = SPANISH_MONTHS[m[2]];
    if (mo) shortDates.push(`${m[1].padStart(2, '0')}/${mo}/${m[3]}`);
  }
  if (shortDates.length >= 2) return { periodStart: shortDates[0], periodEnd: shortDates[shortDates.length - 1] };

  // ISO YYYY-MM-DD
  const isoRegex = /(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))/g;
  const isoDates: string[] = [];
  while ((m = isoRegex.exec(text)) !== null && isoDates.length < 2) isoDates.push(m[1]);
  if (isoDates.length >= 2) return { periodStart: isoDates[0], periodEnd: isoDates[isoDates.length - 1] };

  return { periodStart: null, periodEnd: null };
}

// ── Flexible amount parsing ───────────────────────────────────────────────────

// Matches: $1,234.56 | 1234.56 | -$1,234.56 | (1,234.56) | 1.234,56 (EU)
const AMOUNT_REGEX = /(?<![a-zA-Z\d])(-?\$?\s*[\d]{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\(?\$?\s*[\d]{1,3}(?:,\d{3})*(?:\.\d{1,2})?\)?)/g;

export function parseAmount(raw: string): number | null {
  const s = raw.trim();
  const isNegParen = s.startsWith('(') && s.endsWith(')');
  // Remove currency symbols, parentheses, spaces
  const clean = s.replace(/[$()€£\s]/g, '').replace(/,/g, '');
  const n = parseFloat(clean);
  if (!isFinite(n) || isNaN(n)) return null;
  return isNegParen ? -Math.abs(n) : n;
}

// Extract ALL numeric amounts from text (for debug / fallback)
export function extractAllAmounts(text: string): number[] {
  const results: number[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(AMOUNT_REGEX.source, 'g');
  while ((m = re.exec(text)) !== null) {
    const n = parseAmount(m[0]);
    if (n !== null && Math.abs(n) >= 0.01 && Math.abs(n) <= 9_999_999) {
      results.push(n);
    }
  }
  return results;
}

// ── Labeled totals (structured approach) ─────────────────────────────────────

const DEPOSIT_LABELS = [
  // English
  'TOTAL DEPOSITS', 'TOTAL CREDITS', 'DEPOSITS AND OTHER CREDITS',
  'TOTAL ADDITIONS', 'TOTAL MONEY IN',
  // Spanish
  'TOTAL ABONOS', 'TOTAL DEPOSITOS', 'TOTAL DEPÓSITOS',
  'TOTAL CREDITOS', 'TOTAL CRÉDITOS', 'TOTAL INGRESOS',
  'ABONOS DEL PERIODO', 'ABONOS DEL PERÍODO', 'SUMA DE DEPOSITOS',
  'SUMA DE CRÉDITOS',
];
const WITHDRAWAL_LABELS = [
  // English
  'TOTAL WITHDRAWALS', 'TOTAL DEBITS', 'WITHDRAWALS AND OTHER DEBITS',
  'TOTAL SUBTRACTIONS', 'TOTAL MONEY OUT', 'TOTAL CHECKS AND PAYMENTS',
  // Spanish
  'TOTAL CARGOS', 'TOTAL RETIROS', 'TOTAL DEBITOS', 'TOTAL DÉBITOS',
  'TOTAL EGRESOS', 'CARGOS DEL PERIODO', 'CARGOS DEL PERÍODO',
  'SUMA DE CARGOS', 'SUMA DE RETIROS',
];
const FEE_LABELS = [
  'TOTAL SERVICE CHARGES', 'TOTAL FEES', 'SERVICE FEE',
  'TOTAL COMISIONES', 'COMISIONES DEL PERIODO', 'CARGOS POR SERVICIO',
];

function findLabeledAmount(text: string, labels: string[]): number {
  const upper = text.toUpperCase();
  for (const label of labels) {
    const idx = upper.indexOf(label);
    if (idx === -1) continue;
    // Search 200 chars ahead for a currency value
    const near = text.slice(idx + label.length, idx + label.length + 200);
    const match = near.match(/\$?\s*[\d,]+\.?\d{0,2}/);
    if (match) {
      const amt = parseAmount(match[0]);
      if (amt !== null && amt > 0) return amt;
    }
  }
  return 0;
}

// ── Totals: structured first, then heuristic fallback ───────────────────────

export function parseTotals(text: string): { result: PdfSummary['totals']; usedFallback: boolean } {
  let deposits = findLabeledAmount(text, DEPOSIT_LABELS);
  let withdrawals = findLabeledAmount(text, WITHDRAWAL_LABELS);
  const fees = findLabeledAmount(text, FEE_LABELS);

  if (deposits > 0 || withdrawals > 0) {
    dbg(`structured totals — deposits: ${deposits}, withdrawals: ${withdrawals}, fees: ${fees}`);
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

  // ── Heuristic fallback: scan every line for amounts ──────────────────────
  dbg('falling back to line-by-line amount scan');
  const SKIP_WORDS = [
    'FECHA', 'SALDO', 'TOTAL', 'CONCEPTO', 'DATE', 'BALANCE',
    'DESCRIPTION', 'BEGINNING', 'ENDING', 'SUMMARY',
  ];
  const allAmounts = extractAllAmounts(text);
  dbg(`total amounts detected across full text: ${allAmounts.length}`);

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 6) continue;
    const upper = trimmed.toUpperCase();
    if (SKIP_WORDS.some((w) => upper.includes(w))) continue;

    const lineAmounts = trimmed.match(/[-−]?\$?\s*[\d,]+\.\d{2}/g) ?? [];
    for (const raw of lineAmounts) {
      const n = parseAmount(raw);
      if (n === null || Math.abs(n) < 0.5 || Math.abs(n) > 9_999_999) continue;
      if (n > 0) deposits += n;
      else withdrawals += Math.abs(n);
    }
  }

  deposits = Math.round(deposits * 100) / 100;
  withdrawals = Math.round(withdrawals * 100) / 100;
  dbg(`heuristic totals — deposits: ${deposits}, withdrawals: ${withdrawals}`);

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
  // Match lines with a date pattern AND at least one currency amount
  const count = text.split('\n').filter((line) => {
    const hasDate =
      /\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/.test(line) ||
      /\b(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/i.test(line);
    const hasAmount = /\$?\s*[\d,]+\.\d{2}/.test(line);
    return hasDate && hasAmount;
  }).length;
  dbg(`transaction lines detected: ${count}`);
  return count;
}

// ── Top merchant descriptions ────────────────────────────────────────────────

export function extractTopDescriptions(text: string, limit = 8): string[] {
  const counts: Record<string, number> = {};

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length < 5 || trimmed.length > 90) continue;
    // Must look like a transaction line (date prefix: MM/DD or DD/MM)
    if (!/^\d{1,2}[\/\-]\d{1,2}/.test(trimmed)) continue;

    // Strip leading date token(s)
    let desc = trimmed
      .replace(/^\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\s*/, '')
      .trim();
    // Strip trailing amount(s)
    desc = desc.replace(/\s*[-−]?\$?\s*[\d,]+\.\d{2}\s*$/, '').trim();
    // Strip trailing balance column (second amount in Wells Fargo)
    desc = desc.replace(/\s*\$?\s*[\d,]+\.\d{2}\s*$/, '').trim();

    if (desc.length < 4 || /^\d+$/.test(desc)) continue;
    counts[desc] = (counts[desc] ?? 0) + 1;
  }

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([d]) => d);
}

// ── Main entry point ─────────────────────────────────────────────────────────

export function parsePdfText(text: string): PdfSummary & { error?: string } {
  // Guard: scanned PDF or empty
  const qualityError = checkTextQuality(text);
  if (qualityError) {
    return {
      bankName: null,
      periodStart: null,
      periodEnd: null,
      totals: { deposits: 0, withdrawals: 0, fees: 0, net: 0 },
      transactionCount: 0,
      topDescriptions: [],
      error: qualityError,
    };
  }

  const { result: totals, usedFallback } = parseTotals(text);
  const allAmounts = extractAllAmounts(text);
  dbg(`unique numeric values in document: ${allAmounts.length}`);

  return {
    bankName: detectBank(text),
    ...detectPeriod(text),
    totals,
    transactionCount: countTransactions(text),
    topDescriptions: extractTopDescriptions(text),
    // Inform the UI when we used heuristics so it can show a soft warning
    parseWarning: usedFallback
      ? 'Los totales se estimaron a partir de los movimientos detectados. Verifica los montos contra tu estado de cuenta original.'
      : undefined,
  };
}
