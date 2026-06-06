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

  // Handle repayment increment
  if (body.repayAmount !== undefined) {
    const repay = parseFloat(body.repayAmount);
    if (isNaN(repay) || repay <= 0) {
      return NextResponse.json({ error: "Invalid repay amount" }, { status: 400 });
    }
    const docRef = adminDb.doc(`users/${uid}/lending/${id}`);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Lending item not found" }, { status: 404 });
    }
    const currentPaid = (doc.data()?.paid_amount || 0);
    const totalAmount = (doc.data()?.amount || 0);
    const newPaid = currentPaid + repay;
    const updates: Record<string, unknown> = {
      paid_amount: newPaid,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (newPaid >= totalAmount) {
      updates.status = "settled";
    }
    await docRef.update(updates);
    return NextResponse.json({ message: "Repayment recorded" });
  }

  const allowedFields = ["person_name", "amount", "paid_amount", "status", "description", "date"];
  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      updates[key] =
        (key === "amount" || key === "paid_amount") && typeof body[key] === "string"
          ? parseFloat(body[key])
          : body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  updates["updatedAt"] = FieldValue.serverTimestamp();

  const docRef = adminDb.doc(`users/${uid}/lending/${id}`);
  const doc = await docRef.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Lending item not found" }, { status: 404 });
  }

  await docRef.update(updates);
  return NextResponse.json({ message: "Lending item updated" });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { id } = await params;

  const docRef = adminDb.doc(`users/${uid}/lending/${id}`);
  const doc = await docRef.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Lending item not found" }, { status: 404 });
  }

  await docRef.delete();
  return NextResponse.json({ message: "Lending item deleted" });
}
