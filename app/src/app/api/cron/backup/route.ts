/**
 * POST /api/cron/backup
 *
 * Daily managed Firestore export to a GCS bucket. Kicks off the Firestore
 * Admin `exportDocuments` long-running operation (it returns immediately with
 * an operation name; the export completes asynchronously on Google's side).
 *
 * Requirements:
 *  - `GCS_BACKUP_BUCKET` env set (bucket name, no `gs://` prefix).
 *  - The Admin service account has `roles/datastore.importExportAdmin` and
 *    write access (`roles/storage.objectAdmin`) to the bucket.
 *
 * Restore from a dump: `firebase firestore:import gs://<bucket>/<date>` — see
 * docs/runbook.md.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminAccessToken } from "@/lib/firebase-admin";
import { verifyCronAuth } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const bucket = process.env.GCS_BACKUP_BUCKET;
  if (!bucket) {
    logger.warn({ event: "cron.backup.skipped", reason: "GCS_BACKUP_BUCKET not set" });
    return NextResponse.json({ skipped: true, reason: "GCS_BACKUP_BUCKET not set" });
  }
  if (!projectId) {
    return NextResponse.json({ error: "FIREBASE_PROJECT_ID not set" }, { status: 500 });
  }

  const date = new Date().toISOString().slice(0, 10);
  const outputUriPrefix = `gs://${bucket.replace(/^gs:\/\//, "").replace(/\/$/, "")}/${date}`;

  try {
    const token = await getAdminAccessToken();
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ outputUriPrefix }),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      logger.error({ event: "cron.backup.failed", status: res.status, detail });
      return NextResponse.json(
        { error: "Export request failed", status: res.status },
        { status: 502 }
      );
    }

    const op = (await res.json()) as { name?: string };
    logger.info({ event: "cron.backup.started", outputUriPrefix, operation: op.name });
    return NextResponse.json({ started: true, outputUriPrefix, operation: op.name ?? null });
  } catch (err) {
    logger.error({ event: "cron.backup.fatal" }, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
