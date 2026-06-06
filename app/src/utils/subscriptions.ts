/**
 * Subscription auto-detection.
 *
 * Heuristic — flags merchants where transactions arrive at near-regular
 * intervals (within ±25% of an expected period) AND with stable
 * amounts (±10%). Returns the inferred frequency + best-guess next date.
 */
export interface SubscriptionCandidate {
  merchant: string;
  category: string;
  occurrences: number;
  meanAmount: number;
  frequency: "weekly" | "monthly" | "yearly";
  nextExpected: string;
  confidence: number; // 0..1
}

interface InternalTxn {
  date: string;
  amount: number;
  category: string;
  notes?: string;
  description?: string;
}

const TARGETS: { freq: SubscriptionCandidate["frequency"]; days: number }[] = [
  { freq: "weekly", days: 7 },
  { freq: "monthly", days: 30 },
  { freq: "yearly", days: 365 },
];

function normalizeMerchant(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\d+/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.abs(Math.round((db - da) / 86_400_000));
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  const out = d.toISOString().split("T")[0];
  return out ?? iso;
}

export function detectSubscriptions(transactions: InternalTxn[]): SubscriptionCandidate[] {
  if (transactions.length < 4) return [];

  // Group by normalized merchant key (notes ?? description).
  const groups = new Map<string, InternalTxn[]>();
  for (const t of transactions) {
    if (t.amount >= 0) continue; // expenses only
    const label = t.notes?.trim() || t.description?.trim() || t.category;
    const key = normalizeMerchant(label);
    if (!key) continue;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  const candidates: SubscriptionCandidate[] = [];

  for (const [merchant, txns] of groups.entries()) {
    if (txns.length < 3) continue;
    const sorted = txns.slice().sort((a, b) => a.date.localeCompare(b.date));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1]!.date, sorted[i]!.date));
    }
    const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const target = TARGETS.find((t) => Math.abs(meanGap - t.days) / t.days <= 0.25);
    if (!target) continue;

    const amounts = sorted.map((t) => Math.abs(t.amount));
    const meanAmt = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const amtVariance =
      amounts.reduce((a, b) => a + (b - meanAmt) ** 2, 0) / amounts.length;
    const amtStdDev = Math.sqrt(amtVariance);
    const amtCV = amtStdDev / Math.max(meanAmt, 1);
    if (amtCV > 0.15) continue;

    const last = sorted[sorted.length - 1]!.date;
    const nextExpected = addDays(last, target.days);
    const confidence = Math.min(
      1,
      0.4 + 0.1 * sorted.length + 0.3 * (1 - amtCV) + 0.2 * (1 - Math.abs(meanGap - target.days) / target.days)
    );

    candidates.push({
      merchant: merchant.replace(/\b\w/g, (c) => c.toUpperCase()),
      category: sorted[0]!.category,
      occurrences: sorted.length,
      meanAmount: meanAmt,
      frequency: target.freq,
      nextExpected,
      confidence: Math.round(confidence * 100) / 100,
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}
