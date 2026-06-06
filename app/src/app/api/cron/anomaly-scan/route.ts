/**
 * POST /api/cron/anomaly-scan
 *
 * Weekly cron (Sundays 4 AM UTC). For each user, builds a category
 * baseline from the last 6 cycles and writes anomaly notifications
 * for new outliers in the current cycle.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "@/lib/logger";
import { getAggregate } from "@/server/repos/aggregates";
import { buildCategoryBaseline, detectAnomalies, type AnomalyTxn } from "@/utils/anomalies";

function previousCycleKeys(today: Date, cycleStartDay: number, count: number): string[] {
  const out: string[] = [];
  const d = new Date(today);
  let month = d.getUTCMonth() + 1;
  let year = d.getUTCFullYear();
  if (d.getUTCDate() < cycleStartDay) {
    if (month === 1) {
      month = 12;
      year--;
    } else {
      month--;
    }
  }
  for (let i = 0; i < count; i++) {
    if (month === 1) {
      month = 12;
      year--;
    } else {
      month--;
    }
    out.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return out;
}

function currentCycleKey(today: Date, cycleStartDay: number): string {
  const d = new Date(today);
  let month = d.getUTCMonth() + 1;
  let year = d.getUTCFullYear();
  if (d.getUTCDate() >= cycleStartDay) {
    if (month === 12) {
      month = 1;
      year++;
    } else {
      month++;
    }
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function normalize(raw: string): string {
  return raw.toLowerCase().replace(/\d+/g, "").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let usersScanned = 0;
  let alertsCreated = 0;

  try {
    const usersSnap = await adminDb.collection("users").select("cycleStartDay").get();
    const today = new Date();

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const cycleStartDay = (userDoc.data().cycleStartDay as number) || 25;
      const curKey = currentCycleKey(today, cycleStartDay);
      const prevKeys = previousCycleKeys(today, cycleStartDay, 6);

      try {
        // Load baseline from previous 6 cycles
        const baselineHistory = await Promise.all(
          prevKeys.map(async (key) => {
            const agg = await getAggregate(uid, key);
            return { cycleKey: key, categoryBreakdown: agg.categoryBreakdown };
          })
        );
        const baseline = buildCategoryBaseline(baselineHistory);

        // Load current cycle transactions
        const currentTxns = await adminDb
          .collection(`users/${uid}/transactions`)
          .where("cycleKey", "==", curKey)
          .get();
        const txns: AnomalyTxn[] = currentTxns.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            date: data.date as string,
            amount: data.type === "expense" ? -(data.amount as number) : (data.amount as number),
            category: data.category as string,
            notes: data.notes as string | undefined,
            description: data.description as string | undefined,
          };
        });

        // Load known merchants from the previous 6 cycles
        const knownMerchants = new Set<string>();
        for (const key of prevKeys) {
          const prevTxns = await adminDb
            .collection(`users/${uid}/transactions`)
            .where("cycleKey", "==", key)
            .get();
          for (const t of prevTxns.docs) {
            const data = t.data();
            const label = (data.notes || data.description || data.category) as string | undefined;
            if (label) knownMerchants.add(normalize(label));
          }
        }

        const currentAgg = await getAggregate(uid, curKey);
        const alerts = detectAnomalies({
          currentCycleBreakdown: currentAgg.categoryBreakdown,
          baseline,
          currentCycleTxns: txns,
          knownMerchants,
        });

        // Filter to severity high/medium (avoid notification spam from low-severity)
        const significant = alerts.filter((a) => a.severity !== "low").slice(0, 5);
        if (significant.length === 0) {
          usersScanned++;
          continue;
        }

        const batch = adminDb.batch();
        for (const a of significant) {
          const exists = await adminDb
            .collection(`users/${uid}/notifications`)
            .where("type", "==", "anomaly_detected")
            .where("title", "==", a.title)
            .where("read", "==", false)
            .limit(1)
            .get();
          if (!exists.empty) continue;

          const ref = adminDb.collection(`users/${uid}/notifications`).doc();
          batch.set(ref, {
            type: "anomaly_detected",
            title: a.title,
            message: a.message,
            link: a.txnId ? `/transactions?focus=${a.txnId}` : "/reports",
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });
          alertsCreated++;
        }
        await batch.commit();
      } catch (err) {
        logger.warn({ event: "cron.anomaly_scan.user_failed", uid }, err);
      }
      usersScanned++;
    }

    logger.info({ event: "cron.anomaly_scan.done", usersScanned, alertsCreated });
    return NextResponse.json({ usersScanned, alertsCreated });
  } catch (err) {
    logger.error({ event: "cron.anomaly_scan.fatal" }, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
