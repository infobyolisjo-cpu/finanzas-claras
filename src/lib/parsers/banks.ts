// ── Layer 2: Bank detection + bank-specific summary rules ────────────────────
// Identifies the issuing bank and applies structured-summary overrides when the
// bank exposes an explicit account-activity summary box (e.g. Wells Fargo).
// All other banks fall back to the universal cluster-based Layer 1 result.

// ── Bank patterns ─────────────────────────────────────────────────────────────

const BANK_PATTERNS: { patterns: string[]; name: string }[] = [
  { patterns: ['WELLS FARGO'],                       name: 'Wells Fargo'     },
  { patterns: ['CHASE', 'JPMORGAN'],                 name: 'Chase'           },
  { patterns: ['BANK OF AMERICA', 'BANKOFAMERICA'],  name: 'Bank of America' },
  { patterns: ['CAPITAL ONE'],                       name: 'Capital One'     },
  { patterns: ['CITIBANK', 'CITI BANK'],             name: 'Citibank'        },
  { patterns: ['US BANK', 'USBANK'],                 name: 'US Bank'         },
  { patterns: ['BBVA', 'BANCOMER'],                  name: 'BBVA'            },
  { patterns: ['SANTANDER'],                         name: 'Santander'       },
  { patterns: ['BANAMEX', 'CITIBANAMEX'],            name: 'Citibanamex'     },
  { patterns: ['BANORTE'],                           name: 'Banorte'         },
  { patterns: ['HSBC'],                              name: 'HSBC'            },
  { patterns: ['INBURSA'],                           name: 'Inbursa'         },
  { patterns: ['SCOTIABANK'],                        name: 'Scotiabank'      },
  { patterns: ['BANCO AZTECA', 'AZTECA'],            name: 'Banco Azteca'    },
  { patterns: ['BANBAJIO', 'BAN BAJIO'],             name: 'BanBajío'        },
  { patterns: ['AFIRME'],                            name: 'Afirme'          },
  { patterns: ['NU BANK', 'NUBANK', 'NU MEXICO'],   name: 'Nu'              },
  { patterns: ['MERCADO PAGO', 'MERCADOPAGO'],       name: 'Mercado Pago'    },
  { patterns: ['AMERICAN EXPRESS', 'AMEX'],          name: 'American Express'},
  { patterns: ['INTERCAM'],                          name: 'Intercam'        },
  { patterns: ['MIFEL'],                             name: 'Mifel'           },
];

export function detectBank(text: string): string | null {
  const upper = text.toUpperCase().slice(0, 5_000);
  for (const b of BANK_PATTERNS) {
    if (b.patterns.some(p => upper.includes(p))) return b.name;
  }
  return null;
}

// ── Period detection (English + Spanish) ──────────────────────────────────────

const SPANISH_MONTHS: Record<string, string> = {
  ENERO:'01', FEBRERO:'02', MARZO:'03', ABRIL:'04', MAYO:'05', JUNIO:'06',
  JULIO:'07', AGOSTO:'08', SEPTIEMBRE:'09', OCTUBRE:'10', NOVIEMBRE:'11', DICIEMBRE:'12',
  ENE:'01', FEB:'02', MAR:'03', ABR:'04', MAY:'05', JUN:'06',
  JUL:'07', AGO:'08', SEP:'09', OCT:'10', NOV:'11', DIC:'12',
};
const ENGLISH_MONTHS: Record<string, string> = {
  JANUARY:'01', FEBRUARY:'02', MARCH:'03', APRIL:'04', MAY:'05', JUNE:'06',
  JULY:'07', AUGUST:'08', SEPTEMBER:'09', OCTOBER:'10', NOVEMBER:'11', DECEMBER:'12',
  JAN:'01', FEB:'02', MAR:'03', APR:'04', JUN:'06',
  JUL:'07', AUG:'08', SEP:'09', OCT:'10', NOV:'11', DEC:'12',
};

export function detectPeriod(text: string): { periodStart: string | null; periodEnd: string | null } {
  // WF / Chase: "Opening/closing date MM/DD/YYYY - MM/DD/YYYY"
  const wf = /(?:opening\/closing\s+date|statement\s+period|account\s+period|period)[:\s\t]+(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–—to\t]+\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(text);
  if (wf) return { periodStart: wf[1], periodEnd: wf[2] };

  // Plain MM/DD/YYYY range
  const slash = /(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–—]\s*(\d{1,2}\/\d{1,2}\/\d{4})/.exec(text);
  if (slash) return { periodStart: slash[1], periodEnd: slash[2] };

  // English: "January 1, 2024 – January 31, 2024"
  const upper = text.toUpperCase();
  const eng = /([A-Z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?\s*[-–—TO]+\s*([A-Z]+)\s+(\d{1,2}),?\s+(\d{4})/i.exec(upper);
  if (eng) {
    const m1 = ENGLISH_MONTHS[eng[1]], m2 = ENGLISH_MONTHS[eng[4]], yr = eng[6];
    if (m1 && m2) return {
      periodStart: `${eng[2].padStart(2,'0')}/${m1}/${eng[3] ?? yr}`,
      periodEnd:   `${eng[5].padStart(2,'0')}/${m2}/${yr}`,
    };
  }

  // Spanish: "DD de MES YYYY"
  const spanRe = /(\d{1,2})\s+DE\s+(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+(?:DE\s+)?(\d{4})/gi;
  const spanDates: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = spanRe.exec(upper)) !== null && spanDates.length < 2) {
    const mo = SPANISH_MONTHS[m[2]];
    if (mo) spanDates.push(`${m[1].padStart(2,'0')}/${mo}/${m[3]}`);
  }
  if (spanDates.length >= 2) return { periodStart: spanDates[0], periodEnd: spanDates[1] };
  if (spanDates.length === 1) return { periodStart: spanDates[0], periodEnd: null };

  // ISO YYYY-MM-DD
  const isoRe = /(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))/g;
  const isoDates: string[] = [];
  while ((m = isoRe.exec(text)) !== null && isoDates.length < 2) isoDates.push(m[1]);
  if (isoDates.length >= 2) return { periodStart: isoDates[0], periodEnd: isoDates[1] };

  return { periodStart: null, periodEnd: null };
}

// ── Opening / ending balance ───────────────────────────────────────────────────

export function detectOpeningEndingBalance(text: string): { opening: number | null; ending: number | null } {
  const openM  = /opening\s+balance[^\d$]*([\d,]+\.\d{2})/i.exec(text);
  const closeM = /ending\s+balance[^\d$]*([\d,]+\.\d{2})/i.exec(text);
  const parse  = (s: string) => parseFloat(s.replace(/,/g, '')) || null;
  return {
    opening: openM  ? parse(openM[1])  : null,
    ending:  closeM ? parse(closeM[1]) : null,
  };
}

// ── Fee detection (generic) ───────────────────────────────────────────────────

const FEE_LABELS = [
  'TOTAL SERVICE CHARGES','TOTAL FEES','SERVICE FEE',
  'TOTAL COMISIONES','COMISIONES DEL PERIODO','CARGOS POR SERVICIO',
];

export function detectFees(text: string): number {
  const upper = text.toUpperCase();
  for (const label of FEE_LABELS) {
    const idx = upper.indexOf(label);
    if (idx === -1) continue;
    const near = text.slice(idx + label.length, idx + label.length + 200);
    const m = near.match(/\$?\s*[\d,]+\.\d{2}/);
    if (m) {
      const n = parseFloat(m[0].replace(/[$,\s]/g, ''));
      if (n > 0) return n;
    }
  }
  return 0;
}

// ── Bank-specific summary parsers ─────────────────────────────────────────────

export type BankSummary = {
  deposits: number;
  withdrawals: number;
  fees: number;
  expectedCount?: number;
};

// ── Wells Fargo Account Activity Summary box ──────────────────────────────────
// Format:  "Deposits/Credits     N items, plus  $X,XXX.XX"
//          "Withdrawals/Debits   N items, less  $X,XXX.XX"
//          "Service charges/Fees N transaction(s), less $XX.XX"
// The box appears near the top; line-by-line scan with a 4-line lookahead window
// handles two-column PDF layouts where label and amount can land on nearby lines.

export function parseWFSummaryBox(text: string): BankSummary | null {
  const lines = text.split('\n');
  const DEP = /deposits?\s*[/]\s*credits?/i;
  const WIT = /withdrawals?\s*[/]\s*debits?/i;
  const FEE = /service\s+charges?\s*[/]?\s*fees?/i;
  const CNT = /(\d+)\s+(?:items?|transactions?(?:\(?s?\))?)/i;
  const PLU = /(?:plus|[+])\s*\$?\s*([\d,]+\.?\d*)/i;
  const LES = /(?:less|[-])\s*\$?\s*([\d,]+\.?\d*)/i;

  let deposits = 0, withdrawals = 0, fees = 0;
  let depCount = 0, witCount = 0, feeCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const flat = lines[i].replace(/\s+/g, ' ');
    const win  = lines.slice(i, Math.min(i + 4, lines.length)).join(' ').replace(/\s+/g, ' ');

    if (DEP.test(flat)) {
      const cm = CNT.exec(win), am = PLU.exec(win);
      if (cm) depCount  = parseInt(cm[1]);
      if (am) deposits  = parseFloat(am[1].replace(/,/g, '')) || 0;
      console.log(`[wf-summary] deposits=${deposits} (${depCount} items)`);
    }
    if (WIT.test(flat)) {
      const cm = CNT.exec(win), am = LES.exec(win);
      if (cm) witCount    = parseInt(cm[1]);
      if (am) withdrawals = parseFloat(am[1].replace(/,/g, '')) || 0;
      console.log(`[wf-summary] withdrawals=${withdrawals} (${witCount} items)`);
    }
    if (FEE.test(flat)) {
      const am = LES.exec(win);
      if (am) fees = parseFloat(am[1].replace(/,/g, '')) || 0;
    }
  }

  console.log(`[wf-summary] result: dep=${deposits} wit=${withdrawals} fees=${fees}`);
  if (deposits === 0 && withdrawals === 0) return null;
  return {
    deposits, withdrawals, fees,
    expectedCount: depCount + witCount + feeCount,
  };
}

// ── Chase: similar column layout, no explicit summary box ────────────────────
// Relies on universal cluster detection — no override needed.
// Bank-specific hook kept for future Chase-specific quirks.
export function parseChaseOverride(_text: string): BankSummary | null {
  return null; // universal Layer 1 handles Chase
}

// ── Bank of America: signed amounts (negative = withdrawal) ──────────────────
// BoA PDFs sometimes use a single amount column with negative values.
// The universal cluster approach handles this via the sign-based fallback.
export function parseBofAOverride(_text: string): BankSummary | null {
  return null; // universal Layer 1 handles BoA
}

// ── Capital One: similar to BoA, signed single-column ────────────────────────
export function parseCapOneOverride(_text: string): BankSummary | null {
  return null; // universal Layer 1 handles CapOne
}

// ── Dispatcher: try bank-specific summary, return null to fall through ────────

export function tryBankSummary(bankName: string | null, text: string): BankSummary | null {
  switch (bankName) {
    case 'Wells Fargo':     return parseWFSummaryBox(text);
    case 'Chase':           return parseChaseOverride(text);
    case 'Bank of America': return parseBofAOverride(text);
    case 'Capital One':     return parseCapOneOverride(text);
    default:                return null;
  }
}
