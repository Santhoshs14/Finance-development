/**
 * POST /api/cron/fetch-nav
 *
 * Daily cron (22:30 UTC = 4:00 AM IST next day, AFTER AMFI updates).
 * Pulls the AMFI NAVAll.txt, writes a compact index into
 * `system/navIndex/funds/{schemeCode}`, and updates each user's
 * investments where a matching scheme_code is set.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "@/lib/logger";
import { fetchAmfiNav } from "@/server/jobs/fetchNav";

const MAX_PER_BATCH = 400; // Firestore batch hard cap is 500

type NavEntry = Awaited<ReturnType<typeof fetchAmfiNav>>[number];

/**
 * Update one user's holdings in a single collection where `scheme_code`
 * matches a fetched NAV. Canonical `investments` are read via `current_price`;
 * legacy `mutualFunds` are read via `current_nav` — so write both on legacy
 * docs to ensure the update surfaces in every reader.
 */
async function updateHoldingsForUser(
  uid: string,
  collectionName: "investments" | "mutualFunds",
  isLegacy: boolean,
  byCode: Map<string, NavEntry>
): Promise<number> {
  const snap = await adminDb
    .collection(`users/${uid}/${collectionName}`)
    .where("scheme_code", "!=", null)
    .get();
  if (snap.empty) return 0;

  const batch = adminDb.batch();
  let count = 0;
  for (const docSnap of snap.docs) {
    const code = docSnap.data().scheme_code as string | undefined;
    if (!code) continue;
    const nav = byCode.get(code);
    if (!nav) continue;
    const update: Record<string, unknown> = {
      current_price: nav.nav,
      last_nav_update: nav.date,
    };
    if (isLegacy) update.current_nav = nav.nav;
    batch.update(docSnap.ref, update);
    batch.set(adminDb.doc(`users/${uid}/navHistory/${code}_${nav.date}`), {
      scheme_code: code,
      nav: nav.nav,
      date: nav.date,
      createdAt: FieldValue.serverTimestamp(),
    });
    count++;
  }
  try {
    await batch.commit();
  } catch (err) {
    logger.warn(
      { event: "cron.fetch_nav.user_failed", uid, collection: collectionName },
      err
    );
  }
  return count;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const entries = await fetchAmfiNav();
    if (entries.length === 0) {
      return NextResponse.json({ error: "Empty NAV file" }, { status: 502 });
    }

    // 1) Write the system NAV index in batches.
    let written = 0;
    for (let i = 0; i < entries.length; i += MAX_PER_BATCH) {
      const slice = entries.slice(i, i + MAX_PER_BATCH);
      const batch = adminDb.batch();
      for (const e of slice) {
        batch.set(adminDb.doc(`system/navIndex/funds/${e.schemeCode}`), {
          schemeCode: e.schemeCode,
          schemeName: e.schemeName,
          fundHouse: e.fundHouse,
          isin: e.isin ?? null,
          nav: e.nav,
          date: e.date,
          updatedAt: FieldValue.serverTimestamp(),
        });
        written++;
      }
      await batch.commit();
    }

    // 2) Update each user's holdings across BOTH the canonical `investments`
    //    collection and the legacy `mutualFunds` collection where scheme_code
    //    matches a fetched NAV.
    const byCode = new Map<string, NavEntry>();
    for (const e of entries) byCode.set(e.schemeCode, e);

    let investmentsUpdated = 0;
    const usersSnap = await adminDb.collection("users").select().get();
    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      investmentsUpdated += await updateHoldingsForUser(uid, "investments", false, byCode);
      investmentsUpdated += await updateHoldingsForUser(uid, "mutualFunds", true, byCode);
    }

    logger.info({ event: "cron.fetch_nav.done", written, investmentsUpdated });
    return NextResponse.json({ written, investmentsUpdated });
  } catch (err) {
    logger.error({ event: "cron.fetch_nav.fatal" }, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
