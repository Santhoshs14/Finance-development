import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { createContributionSchema } from "@/schemas/goal";
import { ZodError } from "zod";

/**
 * GET  /api/goals/[id]/contributions  → list contributions (newest first)
 * POST /api/goals/[id]/contributions  → record a contribution AND atomically
 *                                        increment the goal's current_amount.
 *
 * Contributions are an append-only audit trail that also feeds the
 * Monte-Carlo forecast (monthly contribution history).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { id } = await params;

  const goal = await adminDb.doc(`users/${uid}/goals/${id}`).get();
  if (!goal.exists) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const snap = await adminDb
    .collection(`users/${uid}/goals/${id}/contributions`)
    .orderBy("date", "desc")
    .get();

  const contributions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ contributions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { id } = await params;

  let parsed;
  try {
    parsed = createContributionSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", code: "VALIDATION_ERROR", details: err.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const goalRef = adminDb.doc(`users/${uid}/goals/${id}`);
  const contribRef = adminDb.collection(`users/${uid}/goals/${id}/contributions`).doc();
  const date = parsed.date ?? new Date().toISOString().split("T")[0];

  try {
    await adminDb.runTransaction(async (txn) => {
      const goalSnap = await txn.get(goalRef);
      if (!goalSnap.exists) throw new Error("GOAL_NOT_FOUND");
      const current = Number(goalSnap.data()?.current_amount ?? 0);

      txn.set(contribRef, {
        amount: parsed.amount,
        date,
        note: parsed.note ?? "",
        createdAt: FieldValue.serverTimestamp(),
      });
      txn.update(goalRef, {
        current_amount: Math.max(0, current + parsed.amount),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "GOAL_NOT_FOUND") {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    throw err;
  }

  return NextResponse.json({ id: contribRef.id, message: "Contribution recorded" }, { status: 201 });
}
