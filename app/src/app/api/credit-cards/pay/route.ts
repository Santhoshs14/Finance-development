import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getFinancialCycleForDate } from "@/utils/financialMonth";

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json();
  const { cardId, amount, fromAccountId, date } = body;

  if (!cardId || !amount || !fromAccountId) {
    return NextResponse.json(
      { error: "Missing required fields: cardId, amount, fromAccountId" },
      { status: 400 }
    );
  }

  const payAmount = parseFloat(amount);
  if (isNaN(payAmount) || payAmount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const payDate = date || new Date().toISOString().split("T")[0];

  // Read user's cycleStartDay for proper cycle tagging
  const profileDoc = await adminDb.doc(`users/${uid}`).get();
  const startDay = profileDoc.exists ? (profileDoc.data()?.cycleStartDay || 25) : 25;
  const cycle = getFinancialCycleForDate(payDate, startDay);

  const batch = adminDb.batch();

  // Validate card
  const cardRef = adminDb.doc(`users/${uid}/accounts/${cardId}`);
  const cardDoc = await cardRef.get();
  if (!cardDoc.exists || cardDoc.data()?.type !== "credit") {
    return NextResponse.json({ error: "Credit card not found" }, { status: 404 });
  }
  const ccName = cardDoc.data()?.account_name || "Credit Card";

  // Validate bank account
  const accountRef = adminDb.doc(`users/${uid}/accounts/${fromAccountId}`);
  const accountDoc = await accountRef.get();
  if (!accountDoc.exists) {
    return NextResponse.json({ error: "Source account not found" }, { status: 404 });
  }

  // Reduce credit card liability
  batch.update(cardRef, { liability: FieldValue.increment(-payAmount) });

  // Deduct from bank account
  batch.update(accountRef, { balance: FieldValue.increment(-payAmount) });

  // Record debit transaction on bank account (like old app)
  const debitRef = adminDb.collection(`users/${uid}/transactions`).doc();
  batch.set(debitRef, {
    amount: -payAmount,
    category: "Credit Card Payment",
    payment_type: "Transfer",
    account_id: fromAccountId,
    date: payDate,
    notes: `Payment for ${ccName}`,
    type: "expense",
    cycleKey: cycle.cycleKey,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Record credit transaction on CC (like old app — reduces liability view)
  const creditRef = adminDb.collection(`users/${uid}/transactions`).doc();
  batch.set(creditRef, {
    amount: payAmount,
    category: "Credit Card Payment",
    payment_type: "Credit Card",
    account_id: cardId,
    date: payDate,
    notes: "Thank you for your payment",
    type: "income",
    cycleKey: cycle.cycleKey,
    linked_transfer_id: debitRef.id,
    createdAt: FieldValue.serverTimestamp(),
  });

  // No aggregate updates — CC payments are transfers, excluded from spending/income

  await batch.commit();
  return NextResponse.json({ message: "Bill paid successfully", debitId: debitRef.id, creditId: creditRef.id });
}
