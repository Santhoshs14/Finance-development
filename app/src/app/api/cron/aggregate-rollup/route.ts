/**
 * POST /api/cron/aggregate-rollup
 *
 * Daily cron (01:00 UTC). Recomputes aggregates for the *previous* cycle to
 * correct any drift from interleaved writes during the day. The per-user
 * recompute is fanned out across QStash workers (see `src/server/cron/`).
 */
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runDispatcher } from "@/server/cron/dispatch";
import { aggregateRollupJob } from "@/server/cron/jobs";

// Covers the inline-fallback path (no QStash) which may loop all users.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const result = await runDispatcher(aggregateRollupJob);
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ event: "cron.aggregate_rollup.fatal" }, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
