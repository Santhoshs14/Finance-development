/**
 * POST /api/cron/net-worth-snapshot
 *
 * Monthly cron (`0 18 1 * *` — 1st of month, 18:00 UTC). Records a net-worth
 * snapshot for every user so the `/wealth/net-worth` trend chart always has a
 * data point per month. The per-user compute is fanned out across QStash
 * workers (see `src/server/cron/`). Snapshots are keyed by month, so re-runs
 * are idempotent.
 */
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { runDispatcher } from "@/server/cron/dispatch";
import { netWorthSnapshotJob } from "@/server/cron/jobs";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDispatcher(netWorthSnapshotJob);
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ event: "cron.net_worth_snapshot.fatal" }, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
