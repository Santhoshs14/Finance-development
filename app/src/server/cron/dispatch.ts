/**
 * Cron fan-out dispatcher.
 *
 * Runs `job.prepare()` once, then cursor-paginates the `users` collection and
 * publishes one QStash message per page to the job's worker route. QStash
 * delivers the pages in parallel with automatic retries, so no single function
 * invocation has to loop over every user.
 *
 * When QStash is not configured (local dev, self-host, or manual run without
 * keys) the dispatcher falls back to processing every user inline so behaviour
 * is preserved — only the distribution layer changes.
 */
import { Client } from "@upstash/qstash";
import { adminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import type { CronJob } from "./types";

const DEFAULT_USERS_PER_MESSAGE = 100;

export interface DispatchResult {
  job: string;
  mode: "queued" | "inline";
  pages: number;
  users: number;
  processedInline: number;
  errors: number;
}

function qstashClient(): Client | null {
  const token = process.env.QSTASH_TOKEN;
  return token ? new Client({ token }) : null;
}

function workerUrl(jobName: string): string {
  const base =
    process.env.QSTASH_TARGET_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return base ? `${base.replace(/\/$/, "")}/api/cron/worker/${jobName}` : "";
}

async function* pageUserIds(pageSize: number): AsyncGenerator<string[]> {
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  for (;;) {
    let q = adminDb
      .collection("users")
      .orderBy("__name__")
      .limit(pageSize);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) return;
    yield snap.docs.map((d) => d.id);
    if (snap.size < pageSize) return;
    cursor = snap.docs[snap.docs.length - 1];
  }
}

export async function runDispatcher<Ctx extends Record<string, unknown>>(
  job: CronJob<Ctx>
): Promise<DispatchResult> {
  const ctx = await job.prepare();
  const pageSize = job.usersPerMessage ?? DEFAULT_USERS_PER_MESSAGE;
  const client = qstashClient();
  const url = workerUrl(job.name);
  const canQueue = Boolean(client) && url.startsWith("http");

  if (client && !canQueue) {
    logger.warn({
      event: `cron.${job.name}.queue_unconfigured`,
      detail:
        "QSTASH_TOKEN is set but no absolute worker URL could be built; set QSTASH_TARGET_BASE_URL. Falling back to inline processing.",
    });
  }

  let pages = 0;
  let users = 0;
  let processedInline = 0;
  let errors = 0;

  for await (const uids of pageUserIds(pageSize)) {
    pages++;
    users += uids.length;
    if (canQueue && client) {
      await client.publishJSON({
        url,
        body: { job: job.name, ctx, uids },
        retries: 3,
      });
    } else {
      for (const uid of uids) {
        try {
          await job.processUser(uid, ctx);
          processedInline++;
        } catch (err) {
          errors++;
          logger.warn({ event: `cron.${job.name}.user_failed`, uid }, err);
        }
      }
    }
  }

  const mode: DispatchResult["mode"] = canQueue ? "queued" : "inline";
  logger.info({
    event: `cron.${job.name}.dispatched`,
    mode,
    pages,
    users,
    processedInline,
    errors,
  });
  return { job: job.name, mode, pages, users, processedInline, errors };
}
