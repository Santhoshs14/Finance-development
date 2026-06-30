/**
 * POST /api/cron/anomaly-scan
 *
 * Weekly cron (Sundays 04:00 UTC). For each user, builds a category baseline
 * from the last 6 cycles and writes anomaly notifications for outliers in the
 * current cycle. The per-user scan is fanned out across QStash workers (see
 * `src/server/cron/`).
 */
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runDispatcher } from "@/server/cron/dispatch";
import { anomalyScanJob } from "@/server/cron/jobs";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const result = await runDispatcher(anomalyScanJob);
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ event: "cron.anomaly_scan.fatal" }, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
