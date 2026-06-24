/**
 * POST/GET /api/cron/sip
 *
 * Daily cron (18:00 UTC ≈ 11:30 PM IST) that runs AFTER the AMFI NAV refresh
 * (`fetch-nav` at 16:30 UTC), so each SIP buys units at that day's published
 * NAV. For every active SIP due today it deducts cash from the funding account,
 * buys `amount / NAV` units of the linked holding, records an Investment
 * expense, advances the schedule, and notifies the user. Idempotent per day.
 */
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { runDueSips } from "@/server/sip/engine";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];
  if (!today) {
    return NextResponse.json({ error: "Invalid date" }, { status: 500 });
  }

  try {
    const result = await runDueSips(today);
    return NextResponse.json({ success: true, ...result, date: today });
  } catch (err) {
    logger.error({ event: "cron.sip.fatal" }, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
