import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * GET /api/emis
 * Returns all EMIs for the user.
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const snapshot = await adminDb
    .collection(`users/${uid}/emis`)
    .orderBy("startDate", "desc")
    .get();

  const emis = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ emis });
}

/**
 * POST /api/emis
 * Creates a new EMI entry.
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json();
  const {
    cardId,
    description,
    totalAmount,
    emiAmount,
    tenure,
    monthsPaid = 0,
    interestRate = 0,
    startDate,
  } = body;

  if (!description || !totalAmount || !emiAmount || !tenure) {
    return NextResponse.json(
      { error: "description, totalAmount, emiAmount, and tenure are required" },
      { status: 400 }
    );
  }

  const docData = {
    cardId: cardId || null,
    description,
    totalAmount: Number(totalAmount),
    emiAmount: Number(emiAmount),
    tenure: Number(tenure),
    monthsPaid: Number(monthsPaid),
    interestRate: Number(interestRate),
    startDate: startDate || new Date().toISOString().split("T")[0],
    createdAt: FieldValue.serverTimestamp(),
  };

  const docRef = await adminDb.collection(`users/${uid}/emis`).add(docData);
  return NextResponse.json({ id: docRef.id, ...docData }, { status: 201 });
}
