import { classifyAggregateTxn } from "@/utils/calculations";

export interface AggregatableTxn {
  amount?: number;
  type?: string;
  category?: string;
  payment_type?: string;
  cycleKey?: string;
}

/** Aggregate field path -> signed delta. */
export type FieldDeltas = Map<string, number>;

/** cycleKey -> field deltas. A single edit can straddle two cycles. */
export type CycleDeltas = Map<string, FieldDeltas>;

function bump(target: FieldDeltas, field: string, by: number) {
  const next = (target.get(field) ?? 0) + by;
  if (next === 0) target.delete(field);
  else target.set(field, next);
}

/**
 * Field deltas contributed by one transaction. `sign` is +1 to apply and -1 to
 * reverse. Returns null for internal movements that rollups deliberately skip,
 * so the live path and any recompute stay in agreement.
 */
export function aggregateDeltaFor(
  txn: AggregatableTxn,
  sign: 1 | -1,
  investmentCategories: Set<string> = new Set()
): FieldDeltas | null {
  const classification = classifyAggregateTxn(txn);
  if (classification === "skip") return null;

  const amount = Math.abs(Number(txn.amount) || 0);
  const category = String(txn.category || "Uncategorized");
  const deltas: FieldDeltas = new Map();

  if (classification === "expense") {
    bump(deltas, "totalSpent", sign * amount);
    bump(deltas, `categoryBreakdown.${category}`, sign * amount);
    if (investmentCategories.has(category)) {
      bump(deltas, "totalInvestmentSpend", sign * amount);
    }
  } else {
    bump(deltas, "totalIncome", sign * amount);
    bump(deltas, "categoryBreakdown.Income", sign * amount);
  }

  bump(deltas, "transactionCount", sign);
  return deltas;
}

function mergeInto(target: CycleDeltas, cycleKey: string, deltas: FieldDeltas | null) {
  if (!cycleKey || !deltas) return;
  const existing = target.get(cycleKey) ?? new Map<string, number>();
  for (const [field, by] of deltas) bump(existing, field, by);
  if (existing.size === 0) target.delete(cycleKey);
  else target.set(cycleKey, existing);
}

/**
 * Deltas needed to move a transaction from `before` to `after`. Pass a null
 * `before` for a create or a null `after` for a delete. Handles category
 * changes, amount changes, income/expense flips, and moves across cycles.
 */
export function transitionDeltas(
  before: AggregatableTxn | null,
  after: AggregatableTxn | null,
  investmentCategories: Set<string> = new Set()
): CycleDeltas {
  const result: CycleDeltas = new Map();
  if (before?.cycleKey) {
    mergeInto(result, before.cycleKey, aggregateDeltaFor(before, -1, investmentCategories));
  }
  if (after?.cycleKey) {
    mergeInto(result, after.cycleKey, aggregateDeltaFor(after, 1, investmentCategories));
  }
  return result;
}
