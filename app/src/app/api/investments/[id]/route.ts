import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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
    "name", "investment_type", "buy_price", "current_price", "quantity",
    "sip_amount", "account_id", "linked_transaction_id", "linked_goal_id",
    "needs_allocation", "scheme_code", "fund_house",
  ];
  const numericFields = new Set(["buy_price", "current_price", "quantity", "sip_amount"]);
  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      if (numericFields.has(key) && typeof body[key] === "string") {
        updates[key] = parseFloat(body[key]);
      } else {
        updates[key] = body[key];
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  updates["updatedAt"] = FieldValue.serverTimestamp();

  const docRef = adminDb.doc(`users/${uid}/investments/${id}`);
  const doc = await docRef.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Investment not found" }, { status: 404 });
  }

  await docRef.update(updates);
  return NextResponse.json({ message: "Investment updated" });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { id } = await params;

  const docRef = adminDb.doc(`users/${uid}/investments/${id}`);
  const doc = await docRef.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Investment not found" }, { status: 404 });
  }

  await docRef.delete();
  return NextResponse.json({ message: "Investment deleted" });
}
