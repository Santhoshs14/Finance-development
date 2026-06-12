import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { DEFAULT_INVESTMENT_CATEGORIES } from "@/schemas/category";
import { classifyAggregateTxn } from "@/utils/calculations";

/**
 * POST /api/aggregates/recalculate-all
 * Recomputes ALL aggregate documents for a user by scanning all transactions,
 * grouping by cycleKey, and re-writing each aggregate.
 * Used for historical recalculation after schema changes (e.g., adding totalInvestmentSpend).
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  // Fetch user's categories to check classification
  const catSnap = await adminDb.collection(`users/${uid}/categories`).get();
  const investmentCategories = new Set<string>(DEFAULT_INVESTMENT_CATEGORIES);
  for (const catDoc of catSnap.docs) {
    const catData = catDoc.data();
    if (catData.classification === "investment") {
      investmentCategories.add(catData.name);
    }
  }

  // Fetch ALL transactions for this user
  const snapshot = await adminDb
    .collection(`users/${uid}/transactions`)
    .get();

  // Group by cycleKey
  const cycleData: Record<
    string,
    { totalSpent: number; totalIncome: number; totalInvestmentSpend: number; categoryBreakdown: Record<string, number>; transactionCount: number }
  > = {};

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const cycleKey = data.cycleKey;
    if (!cycleKey) return;

    if (!cycleData[cycleKey]) {
      cycleData[cycleKey] = {
        totalSpent: 0,
        totalIncome: 0,
        totalInvestmentSpend: 0,
        categoryBreakdown: {},
        transactionCount: 0,
      };
    }

    const agg = cycleData[cycleKey];
    agg.transactionCount++;

    const amount = data.amount || 0;
    const category = data.category || "Uncategorized";

    const cls = classifyAggregateTxn(data);
    if (cls === "skip") {
      return;
    }

    if (cls === "income") {
      const absAmount = Math.abs(amount);
      agg.totalIncome += absAmount;
      agg.categoryBreakdown.Income = (agg.categoryBreakdown.Income || 0) + absAmount;
    } else {
      const absAmount = Math.abs(amount);
      agg.totalSpent += absAmount;
      agg.categoryBreakdown[category] = (agg.categoryBreakdown[category] || 0) + absAmount;
      if (investmentCategories.has(category)) {
        agg.totalInvestmentSpend += absAmount;
      }
    }
  });

  // Write all aggregates in batches
  let batch = adminDb.batch();
  let batchCount = 0;
  const cycleKeys = Object.keys(cycleData);

  for (const cycleKey of cycleKeys) {
    const docRef = adminDb.doc(`users/${uid}/aggregates/${cycleKey}`);
    batch.set(docRef, {
      ...cycleData[cycleKey],
      cycleKey,
      updatedAt: FieldValue.serverTimestamp(),
    });
    batchCount++;

    // Firestore batch limit is 500
    if (batchCount >= 490) {
      await batch.commit();
      batch = adminDb.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return NextResponse.json({
    message: "All aggregates recalculated",
    cyclesUpdated: cycleKeys.length,
    totalTransactions: snapshot.size,
  });
}
