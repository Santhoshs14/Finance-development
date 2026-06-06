import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

/**
 * PATCH /api/emis/[id]
 * Update an EMI entry (monthsPaid, etc.)
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
    "cardId",
    "description",
    "totalAmount",
    "emiAmount",
    "tenure",
    "monthsPaid",
    "interestRate",
    "startDate",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      updates[key] = ["totalAmount", "emiAmount", "tenure", "monthsPaid", "interestRate"].includes(key)
        ? Number(body[key])
        : body[key];
    }
  }

  const docRef = adminDb.doc(`users/${uid}/emis/${id}`);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await docRef.update(updates);
  return NextResponse.json({ id, ...docSnap.data(), ...updates });
}

/**
 * DELETE /api/emis/[id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { id } = await params;

  const docRef = adminDb.doc(`users/${uid}/emis/${id}`);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await docRef.delete();
  return NextResponse.json({ success: true });
}
