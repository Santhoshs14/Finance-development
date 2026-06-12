import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { DEFAULT_INVESTMENT_CATEGORIES } from "@/schemas/category";
import { classifyAggregateTxn } from "@/utils/calculations";

/**
 * POST /api/aggregates/recalculate
 * Recomputes the aggregate document for a given cycle by scanning all transactions.
 * Body: { cycleKey, startDate, endDate }
 * Can be called by a cron job or manually from settings.
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json();
  const { cycleKey, startDate, endDate } = body;

  if (!cycleKey || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Required: cycleKey, startDate, endDate" },
      { status: 400 }
    );
  }

  // Fetch user's categories to check classification
  const catSnap = await adminDb.collection(`users/${uid}/categories`).get();
  const investmentCategories = new Set<string>(DEFAULT_INVESTMENT_CATEGORIES);
  for (const catDoc of catSnap.docs) {
    const catData = catDoc.data();
    if (catData.classification === "investment") {
      investmentCategories.add(catData.name);
    }
  }

  // Fetch all transactions in the date range
  const snapshot = await adminDb
    .collection(`users/${uid}/transactions`)
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .get();

  let totalSpent = 0;
  let totalIncome = 0;
  let totalInvestmentSpend = 0;
  const categoryBreakdown: Record<string, number> = {};

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const amount = data.amount || 0;
    const category = data.category || "Uncategorized";

    const cls = classifyAggregateTxn(data);
    if (cls === "skip") {
      return;
    }

    if (cls === "income") {
      const absAmount = Math.abs(amount);
      totalIncome += absAmount;
      categoryBreakdown.Income = (categoryBreakdown.Income || 0) + absAmount;
    } else {
      const absAmount = Math.abs(amount);
      totalSpent += absAmount;
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + absAmount;
      // Track productive/investment spend
      if (investmentCategories.has(category)) {
        totalInvestmentSpend += absAmount;
      }
    }
  });

  const aggregateData = {
    totalSpent,
    totalIncome,
    totalInvestmentSpend,
    categoryBreakdown,
    transactionCount: snapshot.size,
    lastUpdated: FieldValue.serverTimestamp(),
  };

  // Write to the aggregates collection
  await adminDb.doc(`users/${uid}/aggregates/${cycleKey}`).set(aggregateData, { merge: true });

  return NextResponse.json({
    message: "Aggregate recalculated",
    cycleKey,
    ...aggregateData,
    lastUpdated: new Date().toISOString(),
  });
}
