import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { createSplitSchema } from "@/schemas/split";
import { zodErrorResponse } from "@/lib/api-handler";

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

  const body = await req.json().catch(() => null);
  const parsed = createSplitSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { description, total_amount, date, participants, paid_by } = parsed.data;

  const data = {
    description,
    total_amount,
    date,
    paid_by,
    participants,
    settled: false,
    settlements: [] as unknown[],
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await adminDb.collection(`users/${uid}/splits`).add(data);
  return NextResponse.json({ id: ref.id, message: "Split created" }, { status: 201 });
}
