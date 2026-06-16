/**
 * POST /api/cron/migrate-mutual-funds
 *
 * One-time, manually triggered migration that folds the legacy `mutualFunds`
 * collection into the canonical `investments` collection (see
 * `migrateMutualFundsJob`). NOT scheduled in `vercel.json` — run it once after
 * deploying the change that drops the client-side mutualFunds merge. Idempotent
 * and safe to re-run.
 */
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { runDispatcher } from "@/server/cron/dispatch";
import { migrateMutualFundsJob } from "@/server/cron/jobs";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDispatcher(migrateMutualFundsJob);
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ event: "cron.migrate_mutual_funds.fatal" }, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
