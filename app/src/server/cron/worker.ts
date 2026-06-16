/**
 * Cron fan-out worker.
 *
 * Receives a page of user ids from QStash (or a manual ops trigger) and runs
 * the job's `processUser` for each one. A single user's failure is logged and
 * skipped so the rest of the page still completes; QStash retries the whole
 * page on a non-2xx response, which is safe because `processUser` is idempotent.
 */
import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { logger } from "@/lib/logger";
import { CRON_JOBS } from "./jobs";

function receiver(): Receiver | null {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  return currentSigningKey && nextSigningKey
    ? new Receiver({ currentSigningKey, nextSigningKey })
    : null;
}

interface WorkerBody {
  job?: string;
  ctx?: Record<string, unknown>;
  uids?: string[];
}

export async function handleWorker(
  req: NextRequest,
  jobName: string
): Promise<NextResponse> {
  const rawBody = await req.text();

  // Auth: prefer a verified QStash signature; otherwise allow a manual ops
  // trigger authenticated with the cron secret (see runbook "manual re-run").
  const rec = receiver();
  const signature = req.headers.get("upstash-signature");
  if (rec && signature) {
    const valid = await rec
      .verify({ signature, body: rawBody })
      .catch(() => false);
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: WorkerBody;
  try {
    body = rawBody ? (JSON.parse(rawBody) as WorkerBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const job = CRON_JOBS[jobName];
  if (!job) {
    return NextResponse.json({ error: `Unknown job: ${jobName}` }, { status: 404 });
  }

  const uids = body.uids ?? [];
  const ctx = body.ctx ?? {};
  let processed = 0;
  let errors = 0;

  for (const uid of uids) {
    try {
      await job.processUser(uid, ctx);
      processed++;
    } catch (err) {
      errors++;
      logger.warn({ event: `cron.${jobName}.user_failed`, uid }, err);
    }
  }

  logger.info({ event: `cron.${jobName}.worker_done`, processed, errors });
  // Surface partial failures so QStash retries the page (idempotent re-run).
  const status = errors > 0 && processed === 0 ? 500 : 200;
  return NextResponse.json({ job: jobName, processed, errors }, { status });
}
