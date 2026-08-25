import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { USER_DATA_COLLECTIONS } from "@/server/userData";
import { logger } from "@/lib/logger";

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

  try {
    const exportData: Record<string, unknown[]> = {};

    // Read profile
    const profileDoc = await adminDb.doc(`users/${uid}`).get();
    const profile = profileDoc.exists ? profileDoc.data() : null;

    // Read each subcollection
    for (const col of USER_DATA_COLLECTIONS) {
      const snap = await adminDb
        .collection(`users/${uid}/${col}`)
        .orderBy("__name__")
        .limit(10000)
        .get();

      exportData[col] = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      ...exportData,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="wealthflow-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    logger.error({ event: "export.failed", uid }, error);
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    );
  }
}
