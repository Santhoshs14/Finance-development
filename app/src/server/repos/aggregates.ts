import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { AggregateDoc } from "@/schemas";
import { DEFAULT_INVESTMENT_CATEGORIES } from "@/schemas/category";
import { classifyAggregateTxn } from "@/utils/calculations";

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

  // Fetch user's categories to check classification
  const catSnap = await adminDb
    .collection(`users/${uid}/categories`)
    .get();
  const investmentCategories = new Set<string>(DEFAULT_INVESTMENT_CATEGORIES);
  for (const catDoc of catSnap.docs) {
    const catData = catDoc.data();
    if (catData.classification === "investment") {
      investmentCategories.add(catData.name);
    }
  }

  let totalSpent = 0;
  let totalIncome = 0;
  let totalInvestmentSpend = 0;
  const categoryBreakdown: Record<string, number> = {};

  for (const doc of snap.docs) {
    const data = doc.data();
    const amount = Math.abs(Number(data.amount) || 0);
    const category = String(data.category || "Uncategorized");
    const cls = classifyAggregateTxn(data);
    if (cls === "expense") {
      totalSpent += amount;
      categoryBreakdown[category] = (categoryBreakdown[category] ?? 0) + amount;
      // Track productive/investment spend separately
      if (investmentCategories.has(category)) {
        totalInvestmentSpend += amount;
      }
    } else if (cls === "income") {
      totalIncome += amount;
      categoryBreakdown.Income = (categoryBreakdown.Income ?? 0) + amount;
    }
  }

  const result: AggregateDoc = {
    totalSpent,
    totalIncome,
    totalInvestmentSpend,
    transactionCount: snap.size,
    categoryBreakdown,
    cycleKey,
  };

  await adminDb
    .doc(`users/${uid}/aggregates/${cycleKey}`)
    .set(
      { ...result, updatedAt: FieldValue.serverTimestamp() },
      { merge: false }
    );

  return result;
}
