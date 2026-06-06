import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const { searchParams } = new URL(req.url);
  const cycleKey = searchParams.get("cycleKey");

  if (!cycleKey) {
    return NextResponse.json(
      { error: "cycleKey is required" },
      { status: 400 }
    );
  }

  const snapshot = await adminDb
    .collection(`users/${uid}/budgetSnapshots/${cycleKey}/categories`)
    .get();

  const budgets = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return NextResponse.json({ budgets });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json();
  const { cycleKey, category, monthly_limit } = body;

  if (!cycleKey || !category || !monthly_limit) {
    return NextResponse.json(
      { error: "Missing required fields: cycleKey, category, monthly_limit" },
      { status: 400 }
    );
  }

  const data = {
    category,
    monthly_limit: parseFloat(monthly_limit),
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await adminDb
    .collection(`users/${uid}/budgetSnapshots/${cycleKey}/categories`)
    .add(data);

  return NextResponse.json({ id: ref.id, message: "Budget created" }, { status: 201 });
}
