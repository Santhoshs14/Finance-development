import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * GET /api/recurring
 * Returns all recurring transaction templates for the user.
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const snapshot = await adminDb
    .collection(`users/${uid}/recurring`)
    .orderBy("amount", "desc")
    .get();

  const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ recurring: items });
}

/**
 * POST /api/recurring
 * Creates a new recurring transaction template.
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json();
  const {
    description,
    category,
    amount,
    frequency,
    next_date,
    account_id,
    payment_type,
    type = "expense",
  } = body;

  if (!description || !category || !amount || !frequency || !next_date) {
    return NextResponse.json(
      { error: "description, category, amount, frequency, and next_date are required" },
      { status: 400 }
    );
  }

  if (!["weekly", "monthly", "yearly"].includes(frequency)) {
    return NextResponse.json(
      { error: "frequency must be weekly, monthly, or yearly" },
      { status: 400 }
    );
  }

  const docData = {
    description,
    category,
    amount: Number(amount),
    frequency,
    next_date,
    account_id: account_id || null,
    payment_type: payment_type || null,
    type,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    last_executed: null,
  };

  const docRef = await adminDb.collection(`users/${uid}/recurring`).add(docData);

  return NextResponse.json({ id: docRef.id, ...docData }, { status: 201 });
}
