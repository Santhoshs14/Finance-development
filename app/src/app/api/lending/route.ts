import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const snapshot = await adminDb
    .collection(`users/${uid}/lending`)
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
  const { type, person_name, amount, date, description, status } = body;

  if (!type || !person_name || !amount || !date) {
    return NextResponse.json(
      { error: "Missing required fields: type, person_name, amount, date" },
      { status: 400 }
    );
  }

  const data = {
    type,
    person_name,
    amount: parseFloat(amount),
    paid_amount: 0,
    date,
    description: description || "",
    status: status || "pending",
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await adminDb.collection(`users/${uid}/lending`).add(data);
  return NextResponse.json({ id: ref.id, message: "Lending item created" }, { status: 201 });
}
