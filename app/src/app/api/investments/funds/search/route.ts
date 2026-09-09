import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/investments/funds/search?q=...
 *
 * Prefix search over the daily AMFI scheme index (`system/navIndex/funds`,
 * refreshed by the fetch-nav cron). Returns up to 20 matches with the latest
 * NAV so the Mutual Funds picker can prefill scheme_code / name / NAV.
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  // Cheap abuse guard — search hits a large shared collection.
  const rl = await rateLimit({ key: `fund-search:${uid}`, limit: 40, windowSec: 60 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  if (q.length < 2) {
    return NextResponse.json({ funds: [] });
  }

  const snap = await adminDb
    .collection("system/navIndex/funds")
    .orderBy("schemeNameLower")
    .startAt(q)
    .endAt(`${q}\uf8ff`)
    .limit(20)
    .get();

  if (snap.empty) {
    // Distinguish "no such fund" from "the NAV index was never built".
    const probe = await adminDb.collection("system/navIndex/funds").limit(1).get();
    if (probe.empty) {
      return NextResponse.json(
        { error: "Fund index is still building. Try again after the next NAV refresh." },
        { status: 503 }
      );
    }
    return NextResponse.json({ funds: [] });
  }

  const funds = snap.docs.map((d) => {
    const data = d.data();
    return {
      scheme_code: (data.schemeCode as string) ?? d.id,
      scheme_name: data.schemeName as string,
      fund_house: data.fundHouse as string,
      nav: data.nav as number,
      date: data.date as string,
    };
  });

  return NextResponse.json({ funds });
}
