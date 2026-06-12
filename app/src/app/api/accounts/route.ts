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
    .orderBy("account_name")
    .get();

  const accounts = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json();
  const { account_name, type, balance, credit_limit, liability, shared_limit_with } = body;

  if (!account_name || !type) {
    return NextResponse.json(
      { error: "Missing required fields: account_name, type" },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {
    account_name,
    type,
    balance: parseFloat(balance || "0"),
    createdAt: FieldValue.serverTimestamp(),
  };

  if (type === "credit") {
    data.credit_limit = parseFloat(credit_limit || "0");
    data.liability = parseFloat(liability || "0");
    if (shared_limit_with) data.shared_limit_with = shared_limit_with;
    if (body.billing_cycle_start_day !== undefined) data.billing_cycle_start_day = parseInt(body.billing_cycle_start_day, 10);
    if (body.due_days_after !== undefined) data.due_days_after = parseInt(body.due_days_after, 10);
    if (body.reward_rate !== undefined) data.reward_rate = parseFloat(body.reward_rate);
    if (body.point_value !== undefined) data.point_value = parseFloat(body.point_value);
    if (body.reward_points_balance !== undefined) data.reward_points_balance = parseFloat(body.reward_points_balance);
  }

  const ref = await adminDb.collection(`users/${uid}/accounts`).add(data);

  return NextResponse.json({ id: ref.id, message: "Account created" }, { status: 201 });
}
