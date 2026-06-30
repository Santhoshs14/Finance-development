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
import { verifyCronAuth } from "@/lib/cron-auth";
import { runDispatcher } from "@/server/cron/dispatch";
import { fetchNavJob } from "@/server/cron/jobs";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

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
