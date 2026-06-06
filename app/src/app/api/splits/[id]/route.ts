import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { id } = await params;

  const body = await req.json();
  const ref = adminDb.doc(`users/${uid}/splits/${id}`);
  const doc = await ref.get();

  if (!doc.exists) {
    return NextResponse.json({ error: "Split not found" }, { status: 404 });
  }

  // Handle settle action
  if (body.settle) {
    const { from, to, amount } = body.settle;
    if (!from || !to || !amount) {
      return NextResponse.json({ error: "Settlement requires from, to, amount" }, { status: 400 });
    }
    const existing = doc.data();
    const settlements = existing?.settlements || [];
    settlements.push({ from, to, amount: parseFloat(amount), date: new Date().toISOString().split("T")[0] });

    // Check if fully settled
    const participants = existing?.participants || [];
    const totalOwed = participants.reduce((sum: number, p: { name: string; share: number }) => {
      return p.name !== existing?.paid_by ? sum + p.share : sum;
    }, 0);
    const totalSettled = settlements.reduce((sum: number, s: { amount: number }) => sum + s.amount, 0);
    const settled = totalSettled >= totalOwed;

    await ref.update({ settlements, settled });
    return NextResponse.json({ message: "Settlement recorded", settled });
  }

  // General update
  const allowedFields = ["description", "total_amount", "date", "participants", "paid_by"];
  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await ref.update(updates);
  return NextResponse.json({ message: "Split updated" });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { id } = await params;

  const ref = adminDb.doc(`users/${uid}/splits/${id}`);
  const doc = await ref.get();

  if (!doc.exists) {
    return NextResponse.json({ error: "Split not found" }, { status: 404 });
  }

  await ref.delete();
  return NextResponse.json({ message: "Split deleted" });
}
