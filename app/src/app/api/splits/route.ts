import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const snapshot = await adminDb
    .collection(`users/${uid}/splits`)
    .orderBy("createdAt", "desc")
    .get();

  const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json();
  const { description, total_amount, date, participants, paid_by } = body;

  if (!description || !total_amount || !date || !participants?.length || !paid_by) {
    return NextResponse.json(
      { error: "Missing required fields: description, total_amount, date, participants, paid_by" },
      { status: 400 }
    );
  }

  const data = {
    description: String(description).slice(0, 200),
    total_amount: parseFloat(total_amount),
    date,
    paid_by,
    participants, // Array of { name, share }
    settled: false,
    settlements: [], // Array of { from, to, amount, date }
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await adminDb.collection(`users/${uid}/splits`).add(data);
  return NextResponse.json({ id: ref.id, message: "Split created" }, { status: 201 });
}
