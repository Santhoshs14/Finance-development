import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const snapshot = await adminDb
    .collection(`users/${uid}/accounts`)
    .where("type", "==", "credit")
    .get();

  const cards = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ cards });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json();
  const { account_name, credit_limit, liability, shared_limit_with } = body;

  if (!account_name) {
    return NextResponse.json({ error: "Missing account_name" }, { status: 400 });
  }

  const data: Record<string, unknown> = {
    account_name,
    type: "credit",
    balance: 0,
    credit_limit: parseFloat(credit_limit || "0"),
    liability: parseFloat(liability || "0"),
    createdAt: FieldValue.serverTimestamp(),
  };

  if (shared_limit_with) data.shared_limit_with = shared_limit_with;

  const ref = await adminDb.collection(`users/${uid}/accounts`).add(data);
  return NextResponse.json({ id: ref.id, message: "Credit card added" }, { status: 201 });
}
