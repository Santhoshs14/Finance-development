import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

/**
 * PATCH /api/recurring/[id]
 * Update a recurring template (status, frequency, amount, next_date, etc.)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { id } = await params;

  const body = await req.json();
  const allowed = [
    "description",
    "category",
    "amount",
    "frequency",
    "next_date",
    "account_id",
    "payment_type",
    "type",
    "status",
    "last_executed",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (updates.status && !["active", "paused", "stopped"].includes(updates.status as string)) {
    return NextResponse.json(
      { error: "status must be active, paused, or stopped" },
      { status: 400 }
    );
  }

  if (updates.frequency && !["weekly", "monthly", "yearly"].includes(updates.frequency as string)) {
    return NextResponse.json(
      { error: "frequency must be weekly, monthly, or yearly" },
      { status: 400 }
    );
  }

  if (updates.amount) updates.amount = Number(updates.amount);

  const docRef = adminDb.doc(`users/${uid}/recurring/${id}`);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await docRef.update(updates);
  return NextResponse.json({ id, ...docSnap.data(), ...updates });
}

/**
 * DELETE /api/recurring/[id]
 * Permanently removes a recurring template.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { id } = await params;

  const docRef = adminDb.doc(`users/${uid}/recurring/${id}`);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await docRef.delete();
  return NextResponse.json({ success: true });
}
