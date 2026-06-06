import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  try {
    const body = await req.json();
    const { transactions } = body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: "No transactions provided" }, { status: 400 });
    }

    if (transactions.length > 100) {
      return NextResponse.json({ error: "Max 100 transactions per batch" }, { status: 400 });
    }

    const batch = adminDb.batch();
    const txnCollection = adminDb.collection(`users/${uid}/transactions`);
    let count = 0;

    for (const txn of transactions) {
      const { date, amount, category, notes, payment_type, type: _type, account_id } = txn;
      if (!date || amount === undefined) continue;

      const docRef = txnCollection.doc();
      batch.set(docRef, {
        date: String(date),
        amount: Number(amount),
        category: String(category || "Other"),
        notes: String(notes || ""),
        payment_type: String(payment_type || "UPI"),
        type: Number(amount) > 0 ? "income" : "expense",
        account_id: account_id || null,
        createdAt: FieldValue.serverTimestamp(),
        source: "csv_import",
      });
      count++;
    }

    await batch.commit();
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Batch import error:", error);
    return NextResponse.json({ error: "Failed to import transactions" }, { status: 500 });
  }
}
