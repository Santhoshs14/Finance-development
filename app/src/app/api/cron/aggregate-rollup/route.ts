/**
 * POST /api/cron/aggregate-rollup
 *
 * Daily cron (01:00 UTC) that recomputes aggregates for the *previous*
 * cycle to correct any drift from interleaved writes during the day.
 * Aggregates for the current cycle stay live via `FieldValue.increment`.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { recalcAggregate } from "@/server/repos/aggregates";

function previousCycleKey(today: Date, cycleStartDay: number): string {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - 1); // ensure we're not on the boundary
  let month = d.getUTCMonth() + 1;
  let year = d.getUTCFullYear();
  if (d.getUTCDate() < cycleStartDay) {
    // current cycle's key is (this month) — previous is (last month)
    if (month === 1) {
      month = 12;
      year--;
    } else {
      month--;
    }
  }
  // Previous cycle = one month before the current cycle key
  if (month === 1) {
    month = 12;
    year--;
  } else {
    month--;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let recomputed = 0;
  let errors = 0;

  try {
    const usersSnap = await adminDb.collection("users").select("cycleStartDay").get();
    const today = new Date();

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const cycleStartDay = (userDoc.data().cycleStartDay as number) || 25;
      const cycleKey = previousCycleKey(today, cycleStartDay);
      try {
        await recalcAggregate(uid, cycleKey);
        recomputed++;
      } catch (err) {
        errors++;
        logger.warn({ event: "cron.aggregate_rollup.user_failed", uid, cycleKey }, err);
      }
    }

    logger.info({ event: "cron.aggregate_rollup.done", recomputed, errors });
    return NextResponse.json({ recomputed, errors });
  } catch (err) {
    logger.error({ event: "cron.aggregate_rollup.fatal" }, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
