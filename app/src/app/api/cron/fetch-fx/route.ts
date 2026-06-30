/**
 * POST /api/cron/fetch-fx
 *
 * Daily cron. Pulls INR-based FX rates and writes them to
 * `system/fxRatesLatest` for the client to read when displaying amounts in a
 * non-INR currency. System-wide (no per-user work), like fetch-gold.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyCronAuth } from "@/lib/cron-auth";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "@/lib/logger";
import { fetchFxRates } from "@/server/jobs/fetchFx";

export async function POST(req: NextRequest) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const fx = await fetchFxRates();
    await adminDb.doc("system/fxRatesLatest").set(
      { ...fx, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    logger.info({
      event: "cron.fetch_fx.done",
      source: fx.source,
      currencies: Object.keys(fx.rates).length,
    });
    return NextResponse.json({ ok: true, date: fx.date, rates: fx.rates });
  } catch (err) {
    logger.error({ event: "cron.fetch_fx.fatal" }, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
