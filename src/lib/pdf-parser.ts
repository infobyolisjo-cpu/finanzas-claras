// Layer 1: PDF text parsing — no AI required.
// Extracts bank, period, totals and top descriptions from raw PDF text.

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
};

// ── Bank detection ──────────────────────────────────────────────────────────

const BANK_PATTERNS: { patterns: string[]; name: string }[] = [
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
  { patterns: ['BBASE', 'BASE'], name: 'Banco Base' },
  { patterns: ['MIFEL'], name: 'Mifel' },
];

export function detectBank(text: string): string | null {
  const upper = text.toUpperCase().slice(0, 3000);
  for (const bank of BANK_PATTERNS) {
    if (bank.patterns.some((p) => upper.includes(p))) return bank.name;
  }
  return null;
}

// ── Period detection ────────────────────────────────────────────────────────

const SPANISH_MONTHS: Record<string, string> = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04',
  MAYO: '05', JUNIO: '06', JULIO: '07', AGOSTO: '08',
  SEPTIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12',
  ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06',
  JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

export function detectPeriod(text: string): { periodStart: string | null; periodEnd: string | null } {
  const upper = text.toUpperCase();

  // DD/MM/YYYY (AL|-) DD/MM/YYYY
  const rangeSlash = /(\d{1,2}\/\d{1,2}\/\d{4})\s*(?:AL|-|A)\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(text);
  if (rangeSlash) return { periodStart: rangeSlash[1], periodEnd: rangeSlash[2] };

  // "Del DD de MES de YYYY al DD de MES de YYYY"
  const spanishRegex =
    /(\d{1,2})\s+DE\s+(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+(?:DE\s+)?(\d{4})/gi;
  const spanishDates: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = spanishRegex.exec(upper)) !== null && spanishDates.length < 2) {
    const mo = SPANISH_MONTHS[m[2]];
    if (mo) spanishDates.push(`${m[1].padStart(2, '0')}/${mo}/${m[3]}`);
  }
  if (spanishDates.length >= 2) return { periodStart: spanishDates[0], periodEnd: spanishDates[spanishDates.length - 1] };
  if (spanishDates.length === 1) return { periodStart: spanishDates[0], periodEnd: null };

  // DD-MMM-YYYY (e.g. 01-ENE-2024)
  const shortMonthRegex = /(\d{1,2})[-\/](ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)[-\/](\d{4})/gi;
  const shortDates: string[] = [];
  while ((m = shortMonthRegex.exec(upper)) !== null && shortDates.length < 2) {
    const mo = SPANISH_MONTHS[m[2]];
    if (mo) shortDates.push(`${m[1].padStart(2, '0')}/${mo}/${m[3]}`);
  }
  if (shortDates.length >= 2) return { periodStart: shortDates[0], periodEnd: shortDates[shortDates.length - 1] };

  // ISO YYYY-MM-DD
  const isoRegex = /(\d{4}-\d{2}-\d{2})/g;
  const isoDates: string[] = [];
  while ((m = isoRegex.exec(text)) !== null && isoDates.length < 2) isoDates.push(m[1]);
  if (isoDates.length >= 2) return { periodStart: isoDates[0], periodEnd: isoDates[isoDates.length - 1] };

  return { periodStart: null, periodEnd: null };
}

// ── Amount parsing ───────────────────────────────────────────────────────────

function parseAmount(str: string): number | null {
  const s = str.trim().replace(/\s/g, '');
  const neg = s.startsWith('(') && s.endsWith(')');
  const clean = s.replace(/[$()]/g, '').replace(/,/g, '');
  const n = parseFloat(clean);
  if (isNaN(n) || !isFinite(n)) return null;
  return neg ? -n : n;
}

// ── Totals detection ─────────────────────────────────────────────────────────

const DEPOSIT_LABELS = [
  'TOTAL ABONOS', 'TOTAL DEPOSITOS', 'TOTAL DEPÓSITOS',
  'TOTAL CREDITOS', 'TOTAL CRÉDITOS', 'TOTAL INGRESOS',
  'ABONOS DEL PERIODO', 'ABONOS DEL PERÍODO', 'SUMA DE DEPOSITOS',
  'SUMA DE CRÉDITOS',
];
const WITHDRAWAL_LABELS = [
  'TOTAL CARGOS', 'TOTAL RETIROS', 'TOTAL DEBITOS', 'TOTAL DÉBITOS',
  'TOTAL EGRESOS', 'CARGOS DEL PERIODO', 'CARGOS DEL PERÍODO',
  'SUMA DE CARGOS', 'SUMA DE RETIROS',
];
const FEE_LABELS = [
  'TOTAL COMISIONES', 'COMISIONES DEL PERIODO', 'COMISIONES DEL PERÍODO',
  'CARGOS POR SERVICIO',
];

function findLabeledAmount(text: string, labels: string[]): number {
  const upper = text.toUpperCase();
  for (const label of labels) {
    const idx = upper.indexOf(label);
    if (idx === -1) continue;
    const near = text.slice(idx + label.length, idx + label.length + 150);
    const match = near.match(/[\$]?\s*[\d,]+\.?\d*/);
    if (match) {
      const amt = parseAmount(match[0]);
      if (amt !== null && amt > 0) return amt;
    }
  }
  return 0;
}

export function parseTotals(text: string): PdfSummary['totals'] {
  let deposits = findLabeledAmount(text, DEPOSIT_LABELS);
  let withdrawals = findLabeledAmount(text, WITHDRAWAL_LABELS);
  const fees = findLabeledAmount(text, FEE_LABELS);

  // Fallback: scan individual transaction lines
  if (deposits === 0 && withdrawals === 0) {
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length < 8) continue;
      const upper = trimmed.toUpperCase();
      if (
        upper.includes('FECHA') || upper.includes('SALDO') ||
        upper.includes('TOTAL') || upper.includes('CONCEPTO')
      ) continue;

      const amounts = trimmed.match(/[\$-]?\s*[\d,]+\.\d{2}/g);
      if (!amounts) continue;
      for (const raw of amounts) {
        const n = parseAmount(raw);
        if (n === null || Math.abs(n) < 1 || Math.abs(n) > 9_999_999) continue;
        if (n > 0) deposits += n;
        else withdrawals += Math.abs(n);
      }
    }
    deposits = Math.round(deposits * 100) / 100;
    withdrawals = Math.round(withdrawals * 100) / 100;
  }

  return {
    deposits,
    withdrawals,
    fees,
    net: Math.round((deposits - withdrawals - fees) * 100) / 100,
  };
}

// ── Transaction count ────────────────────────────────────────────────────────

export function countTransactions(text: string): number {
  return text.split('\n').filter(
    (line) => /\d{1,2}[\/\-]\d{1,2}/.test(line) && /[\$]?\s*[\d,]+\.\d{2}/.test(line)
  ).length;
}

// ── Top merchant descriptions ────────────────────────────────────────────────

export function extractTopDescriptions(text: string, limit = 8): string[] {
  const counts: Record<string, number> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length < 6 || trimmed.length > 80) continue;
    // Must look like a transaction line: starts with date-ish
    if (!/^\d{1,2}[\/\-]/.test(trimmed)) continue;
    // Strip leading date
    const withoutDate = trimmed.replace(/^\d{1,2}[\/\-]\d{1,2}[\/\-]?\d{0,4}\s*/, '').trim();
    // Strip trailing amounts
    const withoutAmount = withoutDate.replace(/[\$]?\s*[\d,]+\.?\d*\s*$/, '').trim();
    if (withoutAmount.length < 4) continue;
    counts[withoutAmount] = (counts[withoutAmount] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([desc]) => desc);
}

// ── Main entry point ─────────────────────────────────────────────────────────

export function parsePdfText(text: string): PdfSummary {
  return {
    bankName: detectBank(text),
    ...detectPeriod(text),
    totals: parseTotals(text),
    transactionCount: countTransactions(text),
    topDescriptions: extractTopDescriptions(text),
  };
}
