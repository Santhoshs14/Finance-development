import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { id } = await params;

  const doc = await adminDb.doc(`users/${uid}/accounts/${id}`).get();
  if (!doc.exists || doc.data()?.type !== "credit") {
    return NextResponse.json({ error: "Credit card not found" }, { status: 404 });
  }
  return NextResponse.json({ card: { id: doc.id, ...doc.data() } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { id } = await params;

  const body = await req.json();
  const allowedFields = [
    "account_name", "credit_limit", "liability", "shared_limit_with",
    "billing_cycle_start_day", "due_days_after",
    "reward_rate", "point_value", "reward_points_balance",
  ];
  const stringFields = new Set(["account_name", "shared_limit_with"]);
  const intFields = new Set(["billing_cycle_start_day", "due_days_after"]);
  const updates: Record<string, unknown> = {};

  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      if (stringFields.has(key)) {
        updates[key] = body[key];
      } else if (intFields.has(key)) {
        updates[key] = parseInt(body[key], 10);
      } else {
        updates[key] = parseFloat(body[key]);
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  updates["updatedAt"] = FieldValue.serverTimestamp();

  const docRef = adminDb.doc(`users/${uid}/accounts/${id}`);
  const doc = await docRef.get();
  if (!doc.exists || doc.data()?.type !== "credit") {
    return NextResponse.json({ error: "Credit card not found" }, { status: 404 });
  }

  await docRef.update(updates);
  return NextResponse.json({ message: "Credit card updated" });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { id } = await params;

  const docRef = adminDb.doc(`users/${uid}/accounts/${id}`);
  const doc = await docRef.get();
  if (!doc.exists || doc.data()?.type !== "credit") {
    return NextResponse.json({ error: "Credit card not found" }, { status: 404 });
  }

  await docRef.delete();
  return NextResponse.json({ message: "Credit card deleted" });
}
