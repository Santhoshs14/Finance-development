import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { saveTaxProfileSchema } from "@/schemas/tax";
import { ZodError } from "zod";

const FY_KEY = /^FY\d{4}-\d{2}$/; // e.g. FY2025-26

/**
 * GET /api/tax/[fy]  → read the saved tax profile for a financial year.
 * PUT /api/tax/[fy]  → upsert the tax profile (gross income, deductions,
 *                      HRA inputs, capital-gain sales).
 *
 * Stored at `users/{uid}/taxProfiles/{fyKey}`. Replaces the previous
 * browser-only `localStorage` storage so the calculator syncs across devices.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fy: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { fy } = await params;

  if (!FY_KEY.test(fy)) {
    return NextResponse.json({ error: "Invalid financial year key" }, { status: 400 });
  }

  const doc = await adminDb.doc(`users/${uid}/taxProfiles/${fy}`).get();
  if (!doc.exists) {
    return NextResponse.json({ profile: null });
  }
  return NextResponse.json({ profile: { fy, ...doc.data() } });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ fy: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { fy } = await params;

  if (!FY_KEY.test(fy)) {
    return NextResponse.json({ error: "Invalid financial year key" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = saveTaxProfileSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", code: "VALIDATION_ERROR", details: err.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  await adminDb.doc(`users/${uid}/taxProfiles/${fy}`).set(
    { fy, ...parsed, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  return NextResponse.json({ message: "Tax profile saved", fy });
}
