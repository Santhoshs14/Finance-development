/**
 * POST /api/cron/fetch-gold
 *
 * Daily cron (17:00 UTC) — writes the latest gold price (22K + 24K
 * INR/gram) into `system/goldPrice/{YYYY-MM-DD}`.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "@/lib/logger";
import { fetchGoldPrice } from "@/server/jobs/fetchGold";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const price = await fetchGoldPrice();
    await adminDb.doc(`system/goldPrice/${price.date}`).set({
      ...price,
      updatedAt: FieldValue.serverTimestamp(),
    });
    // Also expose a "latest" pointer for quick reads.
    await adminDb.doc(`system/goldPriceLatest`).set({
      ...price,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info({ event: "cron.fetch_gold.done", source: price.source, date: price.date });
    return NextResponse.json(price);
  } catch (err) {
    logger.error({ event: "cron.fetch_gold.fatal" }, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
