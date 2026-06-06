/**
 * Capital-gains calculator using FIFO.
 *
 * Supports equity mutual funds, debt mutual funds, and physical gold.
 * Holdings are tracked as ordered "lots" — each buy is a lot, each
 * redemption consumes lots in arrival order.
 *
 * Indian rules (FY 2025-26):
 *   - Equity (>12 months) → LTCG: 12.5% above ₹1.25L gain
 *   - Equity (≤12 months) → STCG: 20%
 *   - Debt MF / Gold (>24 months pre-April-2023 lots only) → LTCG: 12.5% w/ indexation
 *   - Debt MF (post-April-2023) → slab rate (all gains)
 *   - Gold (held >24 months) → LTCG: 12.5%
 */

export type AssetClass = "equity_mf" | "debt_mf" | "gold" | "equity";

export interface Lot {
  date: string;       // YYYY-MM-DD purchase date
  units: number;
  pricePerUnit: number;
}

export interface Redemption {
  date: string;       // sell date
  units: number;
  pricePerUnit: number;
}

export interface CapitalGainRow {
  asset: string;
  assetClass: AssetClass;
  acquiredOn: string;
  soldOn: string;
  units: number;
  cost: number;
  proceeds: number;
  gain: number;
  holdingDays: number;
  classification: "STCG" | "LTCG";
  taxableGain: number;
  tax: number;
}

const STCG_RATE = 0.20;   // equity short-term
const LTCG_RATE_EQUITY = 0.125; // > 1 year equity, above ₹1.25L exemption
const LTCG_EXEMPTION_EQUITY = 1_25_000;
const LTCG_RATE_DEBT_GOLD = 0.125; // long-term debt/gold (post April 2023 reforms)

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86_400_000
  );
}

function classify(assetClass: AssetClass, days: number): "STCG" | "LTCG" {
  if (assetClass === "equity_mf" || assetClass === "equity") {
    return days > 365 ? "LTCG" : "STCG";
  }
  // debt_mf, gold — long-term threshold is 24 months
  return days > 730 ? "LTCG" : "STCG";
}

/**
 * Apply FIFO redemption against the lot list and return per-line gain rows.
 */
export function applyFifoRedemption(
  assetName: string,
  assetClass: AssetClass,
  lots: Lot[],
  redemption: Redemption
): CapitalGainRow[] {
  const queue = lots.slice().sort((a, b) => a.date.localeCompare(b.date));
  let unitsLeft = redemption.units;
  const rows: CapitalGainRow[] = [];

  while (unitsLeft > 0 && queue.length > 0) {
    const lot = queue[0]!;
    const used = Math.min(unitsLeft, lot.units);
    const cost = used * lot.pricePerUnit;
    const proceeds = used * redemption.pricePerUnit;
    const gain = proceeds - cost;
    const days = daysBetween(lot.date, redemption.date);
    const classification = classify(assetClass, days);

    rows.push({
      asset: assetName,
      assetClass,
      acquiredOn: lot.date,
      soldOn: redemption.date,
      units: used,
      cost,
      proceeds,
      gain,
      holdingDays: days,
      classification,
      taxableGain: gain, // pre-exemption — applied at FY rollup
      tax: 0, // filled at FY rollup
    });

    lot.units -= used;
    unitsLeft -= used;
    if (lot.units <= 0) queue.shift();
  }

  return rows;
}

export interface FYCapitalGainsSummary {
  rows: CapitalGainRow[];
  stcgEquity: number;
  ltcgEquity: number;
  stcgDebtGold: number;
  ltcgDebtGold: number;
  estimatedTax: {
    stcgEquity: number;
    ltcgEquity: number;
    stcgDebtGold: number; // slab rate — caller multiplies
    ltcgDebtGold: number;
    total: number;
  };
}

/**
 * Aggregate per-row gains into the standard tax buckets and compute
 * estimated tax (LTCG equity gets the ₹1.25L exemption automatically;
 * STCG debt/gold returns 0 because it's slab-rate and depends on the
 * user's overall income — handled by the regime calculator).
 */
export function rollupFy(rows: CapitalGainRow[]): FYCapitalGainsSummary {
  let stcgEquity = 0,
    ltcgEquity = 0,
    stcgDebtGold = 0,
    ltcgDebtGold = 0;

  for (const r of rows) {
    if (r.assetClass === "equity_mf" || r.assetClass === "equity") {
      if (r.classification === "STCG") stcgEquity += r.gain;
      else ltcgEquity += r.gain;
    } else {
      if (r.classification === "STCG") stcgDebtGold += r.gain;
      else ltcgDebtGold += r.gain;
    }
  }

  const taxLtcgEquity = Math.max(0, ltcgEquity - LTCG_EXEMPTION_EQUITY) * LTCG_RATE_EQUITY;
  const taxStcgEquity = Math.max(0, stcgEquity) * STCG_RATE;
  const taxLtcgDebtGold = Math.max(0, ltcgDebtGold) * LTCG_RATE_DEBT_GOLD;
  // STCG on debt/gold is slab rate — leave for caller to compute via tax regime calc.
  const taxStcgDebtGold = 0;
  const total = taxLtcgEquity + taxStcgEquity + taxLtcgDebtGold + taxStcgDebtGold;

  // Attach per-row estimated tax (proportional within bucket)
  for (const r of rows) {
    if (r.classification === "STCG" && (r.assetClass === "equity_mf" || r.assetClass === "equity")) {
      r.tax = r.gain > 0 ? r.gain * STCG_RATE : 0;
    } else if (r.classification === "LTCG" && (r.assetClass === "equity_mf" || r.assetClass === "equity")) {
      r.tax = r.gain > 0 ? (r.gain / Math.max(ltcgEquity, 1)) * taxLtcgEquity : 0;
    } else if (r.classification === "LTCG") {
      r.tax = r.gain > 0 ? r.gain * LTCG_RATE_DEBT_GOLD : 0;
    } else {
      r.tax = 0; // STCG debt/gold = slab
    }
  }

  return {
    rows,
    stcgEquity,
    ltcgEquity,
    stcgDebtGold,
    ltcgDebtGold,
    estimatedTax: {
      stcgEquity: taxStcgEquity,
      ltcgEquity: taxLtcgEquity,
      stcgDebtGold: taxStcgDebtGold,
      ltcgDebtGold: taxLtcgDebtGold,
      total,
    },
  };
}
