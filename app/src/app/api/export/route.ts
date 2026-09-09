import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { USER_DATA_COLLECTIONS } from "@/server/userData";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

const PAGE_SIZE = 500;

/**
 * GET /api/export
 * Exports all user data as JSON for backup/portability.
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const rl = await rateLimit({ key: `export:${uid}`, limit: 10, windowSec: 3600 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const profileDoc = await adminDb.doc(`users/${uid}`).get();
  const profile = profileDoc.exists ? profileDoc.data() : null;

  const encoder = new TextEncoder();
  // Streamed so large accounts don't buffer the whole export in memory or trip the body limit.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        push(`{"exportedAt":${JSON.stringify(new Date().toISOString())},`);
        push(`"profile":${JSON.stringify(profile)}`);

        for (const col of USER_DATA_COLLECTIONS) {
          push(`,${JSON.stringify(col)}:[`);
          let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
          let first = true;

          for (;;) {
            let q = adminDb
              .collection(`users/${uid}/${col}`)
              .orderBy("__name__")
              .limit(PAGE_SIZE);
            if (cursor) q = q.startAfter(cursor);
            const snap = await q.get();
            if (snap.empty) break;

            for (const doc of snap.docs) {
              push((first ? "" : ",") + JSON.stringify({ id: doc.id, ...doc.data() }));
              first = false;
            }
            if (snap.size < PAGE_SIZE) break;
            cursor = snap.docs[snap.size - 1];
          }
          push("]");
        }

        push("}");
        controller.close();
      } catch (error) {
        logger.error({ event: "export.failed", uid }, error);
        controller.error(error);
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="wealthflow-export-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
