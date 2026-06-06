import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 12), 36);

  const snap = await adminDb
    .collection(`users/${uid}/netWorthSnapshots`)
    .orderBy("month", "desc")
    .limit(limit)
    .get();

  const snapshots = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json(snapshots.reverse());
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json();
  const { month, accounts, investments, cc_outstanding, lent, borrowed, net_worth } = body;

  if (!month || net_worth === undefined) {
    return NextResponse.json({ error: "month and net_worth are required" }, { status: 400 });
  }

  // Use month as document ID to prevent duplicates (e.g. "2025-01")
  const monthStr = String(month).slice(0, 7); // "YYYY-MM"
  const docRef = adminDb.doc(`users/${uid}/netWorthSnapshots/${monthStr}`);

  await docRef.set(
    {
      month: monthStr,
      accounts: accounts ?? 0,
      investments: investments ?? 0,
      cc_outstanding: cc_outstanding ?? 0,
      lent: lent ?? 0,
      borrowed: borrowed ?? 0,
      net_worth: net_worth ?? 0,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return NextResponse.json({ id: monthStr, month: monthStr, net_worth });
}
