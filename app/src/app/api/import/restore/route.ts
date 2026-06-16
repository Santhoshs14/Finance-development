/**
 * POST /api/import/restore
 *
 * Restores a user's data from a `/api/export` JSON payload — closing the
 * export → restore loop. Writes only to the authenticated user's own
 * collections, in chunked Admin SDK batches. Documents keep their original ids
 * and are written with `merge: true`, so re-running is idempotent and never
 * deletes data that isn't in the payload.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { USER_DATA_COLLECTIONS } from "@/server/userData";

export const maxDuration = 300;

const MAX_DOCS_PER_COLLECTION = 10000;
const BATCH_SIZE = 450; // Firestore batch hard cap is 500

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid export payload" }, { status: 400 });
  }

  // Validate sizes up front so we reject before writing anything.
  for (const col of USER_DATA_COLLECTIONS) {
    const items = body[col];
    if (items !== undefined && !Array.isArray(items)) {
      return NextResponse.json(
        { error: `Field "${col}" must be an array` },
        { status: 400 }
      );
    }
    if (Array.isArray(items) && items.length > MAX_DOCS_PER_COLLECTION) {
      return NextResponse.json(
        { error: `Too many documents in "${col}" (max ${MAX_DOCS_PER_COLLECTION})` },
        { status: 400 }
      );
    }
  }

  const restored: Record<string, number> = {};
  let batch = adminDb.batch();
  let pending = 0;
  const flush = async () => {
    if (pending > 0) {
      await batch.commit();
      batch = adminDb.batch();
      pending = 0;
    }
  };

  try {
    // Profile (root user doc) — merge so we don't wipe unrelated settings.
    if (body.profile && typeof body.profile === "object" && !Array.isArray(body.profile)) {
      const { id: _id, ...profile } = body.profile as Record<string, unknown>;
      void _id;
      batch.set(adminDb.doc(`users/${uid}`), profile, { merge: true });
      pending++;
      restored.profile = 1;
    }

    for (const col of USER_DATA_COLLECTIONS) {
      const items = body[col];
      if (!Array.isArray(items)) continue;
      const collectionRef = adminDb.collection(`users/${uid}/${col}`);
      let count = 0;
      for (const raw of items) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const { id, ...data } = raw as { id?: string } & Record<string, unknown>;
        const ref = id ? collectionRef.doc(String(id)) : collectionRef.doc();
        batch.set(ref, data, { merge: true });
        pending++;
        count++;
        if (pending >= BATCH_SIZE) await flush();
      }
      restored[col] = count;
    }

    await flush();
    return NextResponse.json({ success: true, restored });
  } catch (error) {
    console.error("Restore failed:", error);
    return NextResponse.json({ error: "Restore failed" }, { status: 500 });
  }
}
