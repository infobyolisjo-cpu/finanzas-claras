// ── Layer 3: Normalization ────────────────────────────────────────────────────
// Converts raw extraction results into a clean canonical JSON summary.

import type { ParsedTx } from './types';

// ── Quality guard ──────────────────────────────────────────────────────────────

export function checkTextQuality(text: string): string | null {
  const len = text.replace(/\s+/g, ' ').trim().length;
  console.log('[pdf-parser] plain text length:', len);
  if (len < 150) {
    return (
      'Este PDF parece estar escaneado como imagen y no contiene texto extraíble. ' +
      'Descarga el estado de cuenta en formato digital (PDF nativo) desde tu banca en línea, ' +
      'o usa el archivo CSV/XLSX si tu banco lo ofrece.'
    );
  }
  return null;
}

// ── Transaction aggregation ───────────────────────────────────────────────────

export function sumTransactions(
  txs: ParsedTx[],
  fees = 0,
  openingBalance?: number | null,
  endingBalance?: number | null,
): { deposits: number; withdrawals: number; fees: number; net: number } {
  let deposits = 0, withdrawals = 0;
  for (const tx of txs) {
    if (tx.type === 'income')  deposits    += tx.amount;
    else                       withdrawals += tx.amount;
  }
  deposits    = Math.round(deposits    * 100) / 100;
  withdrawals = Math.round(withdrawals * 100) / 100;
  fees        = Math.round(fees        * 100) / 100;

  // Use explicit opening/ending balance for net when available (more accurate).
  const net =
    openingBalance != null && endingBalance != null
      ? Math.round((endingBalance - openingBalance) * 100) / 100
      : Math.round((deposits - withdrawals - fees) * 100) / 100;

  return { deposits, withdrawals, fees, net };
}

// ── Top merchant descriptions ──────────────────────────────────────────────────

export function extractTopDescriptions(txs: ParsedTx[], limit = 8): string[] {
  const freq: Record<string, number> = {};
  for (const tx of txs) {
    const d = tx.description.trim();
    if (d.length < 4) continue;
    freq[d] = (freq[d] ?? 0) + 1;
  }
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([d]) => d);
}

// ── Warning builder ───────────────────────────────────────────────────────────

export function buildWarning(
  detected: number,
  expected: number | undefined,
  usedFallback: boolean,
): { incomplete: boolean; parseWarning?: string } {
  if (expected !== undefined && expected > 0 && detected < expected * 0.6) {
    return {
      incomplete: true,
      parseWarning:
        `Solo se detectaron ${detected} de ${expected} movimientos declarados en el resumen del banco. ` +
        `El PDF podría estar protegido o tener un layout de múltiples columnas. ` +
        `Para mayor precisión descarga el archivo en CSV o Excel desde tu banco.`,
    };
  }
  if (detected === 0) {
    return {
      incomplete: true,
      parseWarning:
        'Formato no reconocido. No se detectaron movimientos. ' +
        'Usa CSV/XLSX desde tu banca en línea para un análisis completo.',
    };
  }
  if (usedFallback && detected < 5) {
    return {
      incomplete: true,
      parseWarning:
        `Solo se detectaron ${detected} movimiento(s). ` +
        `Este PDF podría requerir OCR o descarga en formato CSV/XLSX.`,
    };
  }
  if (usedFallback) {
    return {
      incomplete: false,
      parseWarning:
        'Los totales se estimaron heurísticamente — no se encontró un cuadro de resumen estructurado. ' +
        'Verifica los montos contra tu estado de cuenta original.',
    };
  }
  return { incomplete: false };
}
