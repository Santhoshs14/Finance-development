import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import type { AggregateDoc } from "@/schemas";
import { DEFAULT_INVESTMENT_CATEGORIES } from "@/schemas/category";
import { classifyAggregateTxn } from "@/utils/calculations";
import type { CycleDeltas } from "@/server/aggregates/delta";

/** Category names whose spend also rolls up into `totalInvestmentSpend`. */
export async function getInvestmentCategories(uid: string): Promise<Set<string>> {
  const snap = await adminDb.collection(`users/${uid}/categories`).get();
  const names = new Set<string>(DEFAULT_INVESTMENT_CATEGORIES);
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.classification === "investment") names.add(String(data.name));
  }
  return names;
}

/**
 * Apply cycle deltas to aggregate docs. Uses set/merge so a cycle that has no
 * aggregate document yet is created rather than throwing.
 */
export function applyAggregateDeltas(
  transaction: Transaction,
  uid: string,
  deltas: CycleDeltas
): void {
  for (const [cycleKey, fields] of deltas) {
    const update: Record<string, unknown> = {
      cycleKey,
      updatedAt: FieldValue.serverTimestamp(),
    };
    for (const [field, by] of fields) update[field] = FieldValue.increment(by);
    transaction.set(adminDb.doc(`users/${uid}/aggregates/${cycleKey}`), update, {
      merge: true,
    });
  }
}

export async function getAggregate(
  uid: string,
  cycleKey: string
): Promise<AggregateDoc> {
  const doc = await adminDb.doc(`users/${uid}/aggregates/${cycleKey}`).get();
  if (!doc.exists) {
    return {
      totalSpent: 0,
      totalIncome: 0,
      totalInvestmentSpend: 0,
      transactionCount: 0,
      categoryBreakdown: {},
      cycleKey,
    };
  }
  const data = doc.data() ?? {};
  return {
    totalSpent: Number(data.totalSpent ?? 0),
    totalIncome: Number(data.totalIncome ?? 0),
    totalInvestmentSpend: Number(data.totalInvestmentSpend ?? 0),
    transactionCount: Number(data.transactionCount ?? 0),
    categoryBreakdown:
      (data.categoryBreakdown as Record<string, number>) ?? {},
    cycleKey,
  };
}

/** Recompute an aggregate by scanning transactions for the cycle. */
export async function recalcAggregate(
  uid: string,
  cycleKey: string
): Promise<AggregateDoc> {
  const snap = await adminDb
    .collection(`users/${uid}/transactions`)
    .where("cycleKey", "==", cycleKey)
    .get();

  const investmentCategories = await getInvestmentCategories(uid);

  let totalSpent = 0;
  let totalIncome = 0;
  let totalInvestmentSpend = 0;
  let transactionCount = 0;
  const categoryBreakdown: Record<string, number> = {};

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.deletedAt) continue;

    const amount = Math.abs(Number(data.amount) || 0);
    const category = String(data.category || "Uncategorized");
    const cls = classifyAggregateTxn(data);
    if (cls === "skip") continue;

    transactionCount++;
    if (cls === "expense") {
      totalSpent += amount;
      categoryBreakdown[category] = (categoryBreakdown[category] ?? 0) + amount;
      if (investmentCategories.has(category)) totalInvestmentSpend += amount;
    } else {
      totalIncome += amount;
      categoryBreakdown.Income = (categoryBreakdown.Income ?? 0) + amount;
    }
  }

  const result: AggregateDoc = {
    totalSpent,
    totalIncome,
    totalInvestmentSpend,
    transactionCount,
    categoryBreakdown,
    cycleKey,
  };

  await adminDb
    .doc(`users/${uid}/aggregates/${cycleKey}`)
    .set(
      {
        ...result,
        updatedAt: FieldValue.serverTimestamp(),
        lastVerifiedAt: FieldValue.serverTimestamp(),
      },
      { merge: false }
    );

  return result;
}

const DRIFT_TOLERANCE = 0.01;

export interface ReconcileResult {
  cycleKey: string;
  drifted: boolean;
  fields: string[];
}

/**
 * Compare the stored aggregate against a fresh recompute and heal it if they
 * disagree. Returns which fields drifted so the caller can alert on it.
 */
export async function reconcileAggregate(
  uid: string,
  cycleKey: string
): Promise<ReconcileResult> {
  const stored = await getAggregate(uid, cycleKey);
  const truth = await recalcAggregate(uid, cycleKey);

  const fields: string[] = [];
  const numeric = [
    "totalSpent",
    "totalIncome",
    "totalInvestmentSpend",
    "transactionCount",
  ] as const;

  for (const field of numeric) {
    if (Math.abs(stored[field] - truth[field]) > DRIFT_TOLERANCE) fields.push(field);
  }

  const categories = new Set([
    ...Object.keys(stored.categoryBreakdown),
    ...Object.keys(truth.categoryBreakdown),
  ]);
  for (const category of categories) {
    const a = stored.categoryBreakdown[category] ?? 0;
    const b = truth.categoryBreakdown[category] ?? 0;
    if (Math.abs(a - b) > DRIFT_TOLERANCE) fields.push(`categoryBreakdown.${category}`);
  }

  return { cycleKey, drifted: fields.length > 0, fields };
}
