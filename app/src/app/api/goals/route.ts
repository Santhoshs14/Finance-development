import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { createGoalSchema } from "@/schemas/goal";
import { ZodError } from "zod";

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

  let parsed;
  try {
    parsed = createGoalSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", code: "VALIDATION_ERROR", details: err.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = {
    goal_name: parsed.goal_name,
    target_amount: parsed.target_amount,
    current_amount: parsed.current_amount ?? 0,
    deadline: parsed.deadline,
    description: parsed.description ?? "",
    linked_funds: parsed.linked_funds ?? [],
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await adminDb.collection(`users/${uid}/goals`).add(data);
  return NextResponse.json({ id: ref.id, message: "Goal created" }, { status: 201 });
}
