import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const { searchParams } = new URL(req.url);
  const cycleKey = searchParams.get("cycleKey");

  if (!cycleKey) {
    return NextResponse.json({ error: "cycleKey is required" }, { status: 400 });
  }

  const docRef = adminDb.doc(`users/${uid}/aggregates/${cycleKey}`);
  const doc = await docRef.get();

  if (!doc.exists) {
    return NextResponse.json({
      totalSpent: 0,
      totalIncome: 0,
      categoryBreakdown: {},
      transactionCount: 0,
    });
  }

  return NextResponse.json(doc.data());
}
