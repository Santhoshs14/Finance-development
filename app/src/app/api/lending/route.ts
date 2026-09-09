import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { createLendingSchema } from "@/schemas/lending";
import { zodErrorResponse } from "@/lib/api-handler";

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

  const body = await req.json().catch(() => null);
  const parsed = createLendingSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { type, person_name, amount, date, description, status } = parsed.data;

  const data = {
    type,
    person_name,
    amount,
    paid_amount: 0,
    date,
    description: description || "",
    status: status || "pending",
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await adminDb.collection(`users/${uid}/lending`).add(data);
  return NextResponse.json({ id: ref.id, message: "Lending item created" }, { status: 201 });
}
