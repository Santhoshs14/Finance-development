import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const snapshot = await adminDb
    .collection(`users/${uid}/goals`)
    .orderBy("createdAt", "desc")
    .get();

  const goals = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ goals });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json();
  const { goal_name, target_amount, current_amount, deadline } = body;

  if (!goal_name || !target_amount || !deadline) {
    return NextResponse.json(
      { error: "Missing required fields: goal_name, target_amount, deadline" },
      { status: 400 }
    );
  }

  const data = {
    goal_name,
    target_amount: parseFloat(target_amount),
    current_amount: parseFloat(current_amount || "0"),
    deadline,
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await adminDb.collection(`users/${uid}/goals`).add(data);
  return NextResponse.json({ id: ref.id, message: "Goal created" }, { status: 201 });
}
