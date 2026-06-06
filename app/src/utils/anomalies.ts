/**
 * Anomaly detection v2.
 *
 * Combines three signals into a single list of `AnomalyAlert` events:
 *   1. Z-score per category against the 6-cycle baseline.
 *   2. Unusual-amount transactions (z-score > 2.5 within their category).
 *   3. New-merchant detection (first time spending in a given group).
 *
 * Used by:
 *   - Dashboard "Anomaly alerts" widget
 *   - Cron `/api/cron/anomaly-scan` to emit notifications weekly
 */

export interface AnomalyTxn {
  id: string;
  date: string;
  amount: number;
  category: string;
  notes?: string;
  description?: string;
}

export interface CategoryBaseline {
  category: string;
  meanSpend: number;
  stdDevSpend: number;
}

export interface AnomalyAlert {
  id: string;
  type: "category_spike" | "unusual_txn" | "new_merchant";
  severity: "low" | "medium" | "high";
  title: string;
  message: string;
  txnId?: string;
  category?: string;
  amount?: number;
}

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[], mu: number): number {
  if (arr.length < 2) return 0;
  return Math.sqrt(arr.reduce((a, b) => a + (b - mu) ** 2, 0) / (arr.length - 1));
}

/**
 * Build per-category baseline statistics from previous cycle totals.
 *
 * @param history Array of { cycleKey, categoryBreakdown }.
 */
export function buildCategoryBaseline(
  history: { cycleKey: string; categoryBreakdown: Record<string, number> }[]
): CategoryBaseline[] {
  const byCategory = new Map<string, number[]>();
  for (const c of history) {
    for (const [cat, val] of Object.entries(c.categoryBreakdown ?? {})) {
      if (cat === "Income") continue;
      const arr = byCategory.get(cat) ?? [];
      arr.push(val);
      byCategory.set(cat, arr);
    }
  }
  return Array.from(byCategory.entries()).map(([category, values]) => {
    const mu = mean(values);
    return { category, meanSpend: mu, stdDevSpend: stdDev(values, mu) };
  });
}

export interface AnomalyDetectionInput {
  currentCycleBreakdown: Record<string, number>;
  baseline: CategoryBaseline[];
  /** Transactions of the current cycle (used for unusual-txn + new-merchant). */
  currentCycleTxns: AnomalyTxn[];
  /** Merchant keys seen in previous cycles (for new-merchant detection). */
  knownMerchants: Set<string>;
}

function normalizeMerchant(raw: string): string {
  return raw.toLowerCase().replace(/\d+/g, "").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

export function detectAnomalies(input: AnomalyDetectionInput): AnomalyAlert[] {
  const out: AnomalyAlert[] = [];
  const { currentCycleBreakdown, baseline, currentCycleTxns, knownMerchants } = input;

  // 1) Category spikes
  for (const b of baseline) {
    const current = currentCycleBreakdown[b.category] ?? 0;
    if (b.stdDevSpend === 0 || current === 0) continue;
    const z = (current - b.meanSpend) / b.stdDevSpend;
    if (z >= 2) {
      const severity: AnomalyAlert["severity"] = z >= 3 ? "high" : "medium";
      out.push({
        id: `cat-${b.category}-${current.toFixed(0)}`,
        type: "category_spike",
        severity,
        title: `Unusual ${b.category} spending`,
        message: `Your ${b.category} spend is ${z.toFixed(1)}σ above the recent average (₹${current.toLocaleString("en-IN")} vs ~₹${Math.round(b.meanSpend).toLocaleString("en-IN")}).`,
        category: b.category,
        amount: current,
      });
    }
  }

  // 2) Unusual single transactions (within their category)
  const txnsByCategory = new Map<string, AnomalyTxn[]>();
  for (const t of currentCycleTxns) {
    if (t.amount >= 0) continue;
    const arr = txnsByCategory.get(t.category) ?? [];
    arr.push(t);
    txnsByCategory.set(t.category, arr);
  }
  for (const [cat, txns] of txnsByCategory.entries()) {
    if (txns.length < 3) continue;
    const amounts = txns.map((t) => Math.abs(t.amount));
    const mu = mean(amounts);
    const sd = stdDev(amounts, mu);
    if (sd === 0) continue;
    for (const t of txns) {
      const abs = Math.abs(t.amount);
      const z = (abs - mu) / sd;
      if (z >= 2.5) {
        out.push({
          id: `txn-${t.id}`,
          type: "unusual_txn",
          severity: z >= 4 ? "high" : "medium",
          title: `Large ${cat} transaction`,
          message: `₹${abs.toLocaleString("en-IN")} is ${z.toFixed(1)}σ above your typical ${cat} spend.`,
          txnId: t.id,
          category: cat,
          amount: abs,
        });
      }
    }
  }

  // 3) New merchants
  const seenThisCycle = new Map<string, AnomalyTxn>();
  for (const t of currentCycleTxns) {
    if (t.amount >= 0) continue;
    const label = (t.notes || t.description || t.category).trim();
    const key = normalizeMerchant(label);
    if (!key) continue;
    if (knownMerchants.has(key)) continue;
    if (!seenThisCycle.has(key)) seenThisCycle.set(key, t);
  }
  for (const [key, t] of seenThisCycle.entries()) {
    out.push({
      id: `merchant-${key}`,
      type: "new_merchant",
      severity: "low",
      title: `New merchant: ${key.replace(/\b\w/g, (c) => c.toUpperCase())}`,
      message: `First time spending here — ₹${Math.abs(t.amount).toLocaleString("en-IN")} on ${t.date}.`,
      txnId: t.id,
      amount: Math.abs(t.amount),
    });
  }

  // Sort by severity then amount (desc)
  const sevRank: Record<AnomalyAlert["severity"], number> = { high: 3, medium: 2, low: 1 };
  out.sort((a, b) => {
    const sr = sevRank[b.severity] - sevRank[a.severity];
    if (sr !== 0) return sr;
    return (b.amount ?? 0) - (a.amount ?? 0);
  });

  return out;
}
