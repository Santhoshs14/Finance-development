/**
 * POST /api/cron/fetch-nav
 *
 * Daily cron (16:30 UTC, after AMFI updates). `prepare()` pulls the AMFI
 * NAVAll.txt once and writes the shared `system/navIndex/funds/{schemeCode}`
 * index; the fan-out workers then update each user's holdings from that index
 * (see `src/server/cron/`).
 */
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { runDispatcher } from "@/server/cron/dispatch";
import { fetchNavJob } from "@/server/cron/jobs";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDispatcher(fetchNavJob);
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ event: "cron.fetch_nav.fatal" }, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
