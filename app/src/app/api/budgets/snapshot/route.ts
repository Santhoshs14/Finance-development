import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const { searchParams } = new URL(req.url);
  const cycleKey = searchParams.get("cycle");

  if (!cycleKey) {
    return NextResponse.json({ error: "cycle query param is required" }, { status: 400 });
  }

  const snapshot = await adminDb
    .collection(`users/${uid}/budgetSnapshots/${cycleKey}/categories`)
    .get();

  // Build lookup maps from user's categories for resolving old budget keys
  const catSnapshot = await adminDb.collection(`users/${uid}/categories`).get();
  const slugToName: Record<string, string> = {};
  const nameSet = new Set<string>();
  catSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.name) {
      slugToName[doc.id] = data.name;           // "food" → "Food"
      slugToName[doc.id.toLowerCase()] = data.name;
      nameSet.add(data.name);                   // track valid names
    }
  });

  // Convert slug to title case as fallback (e.g., "credit-card-payment" → "Credit Card Payment")
  const slugToTitleCase = (slug: string) =>
    slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const budgets: Record<string, number> = {};
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const limit = data.monthly_limit || data.limit || 0;
    if (limit <= 0) return;
    const raw = data.category || data.categoryId || doc.id;

    // Resolution priority: direct slug map → raw if it's already a valid name → title-case fallback
    let key: string;
    if (slugToName[raw]) {
      key = slugToName[raw];
    } else if (nameSet.has(raw)) {
      key = raw;
    } else {
      // Try title-case as last resort, but only include if it matches a real category
      const titleCased = slugToTitleCase(raw);
      if (nameSet.has(titleCased)) {
        key = titleCased;
      } else {
        // Category no longer exists — skip it
        return;
      }
    }
    budgets[key] = limit;
  });

  return NextResponse.json({ budgets, cycleKey });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json();
  const { cycleKey, categoryId, limit } = body;

  if (!cycleKey || !categoryId || limit === undefined) {
    return NextResponse.json(
      { error: "Missing required fields: cycleKey, categoryId, limit" },
      { status: 400 }
    );
  }

  const docRef = adminDb.doc(`users/${uid}/budgetSnapshots/${cycleKey}/categories/${categoryId}`);
  await docRef.set(
    {
      categoryId,
      category: categoryId,
      limit: parseFloat(limit),
      monthly_limit: parseFloat(limit),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({ message: "Budget limit saved" });
}
