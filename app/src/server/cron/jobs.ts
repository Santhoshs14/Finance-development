/**
 * Fan-out cron job registry.
 *
 * Each job's `prepare()` runs once in the dispatcher; `processUser()` runs in
 * the worker for a single user and must be idempotent (QStash delivers
 * at-least-once and retries on failure).
 */
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { recalcAggregate, getAggregate } from "@/server/repos/aggregates";
import {
  computeUserNetWorth,
  saveNetWorthSnapshot,
} from "@/server/repos/netWorth";
import { fetchAmfiNav } from "@/server/jobs/fetchNav";
import {
  buildCategoryBaseline,
  detectAnomalies,
  type AnomalyTxn,
} from "@/utils/anomalies";
import {
  currentCycleKey,
  previousCycleKey,
  previousCycleKeys,
} from "./cycles";
import type { CronJob } from "./types";

const MAX_PER_BATCH = 400; // Firestore batch hard cap is 500

async function getCycleStartDay(uid: string): Promise<number> {
  const doc = await adminDb.doc(`users/${uid}`).get();
  return (doc.data()?.cycleStartDay as number) || 25;
}

// ── aggregate-rollup ────────────────────────────────────────────────────────
export const aggregateRollupJob: CronJob<{ todayISO: string }> = {
  name: "aggregate-rollup",
  async prepare() {
    return { todayISO: new Date().toISOString() };
  },
  async processUser(uid, ctx) {
    const cycleStartDay = await getCycleStartDay(uid);
    const cycleKey = previousCycleKey(new Date(ctx.todayISO), cycleStartDay);
    await recalcAggregate(uid, cycleKey);
  },
};

// ── net-worth-snapshot ──────────────────────────────────────────────────────
export const netWorthSnapshotJob: CronJob<{ month: string }> = {
  name: "net-worth-snapshot",
  async prepare() {
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1
    ).padStart(2, "0")}`;
    return { month };
  },
  async processUser(uid, ctx) {
    const totals = await computeUserNetWorth(uid);
    await saveNetWorthSnapshot(uid, { month: ctx.month, ...totals });
  },
};

// ── anomaly-scan ────────────────────────────────────────────────────────────
function normalizeMerchant(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\d+/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const anomalyScanJob: CronJob<{ todayISO: string }> = {
  name: "anomaly-scan",
  // Heavier per-user work (reads ~7 cycles of transactions) → smaller pages.
  usersPerMessage: 50,
  async prepare() {
    return { todayISO: new Date().toISOString() };
  },
  async processUser(uid, ctx) {
    const today = new Date(ctx.todayISO);
    const cycleStartDay = await getCycleStartDay(uid);
    const curKey = currentCycleKey(today, cycleStartDay);
    const prevKeys = previousCycleKeys(today, cycleStartDay, 6);

    const baselineHistory = await Promise.all(
      prevKeys.map(async (key) => {
        const agg = await getAggregate(uid, key);
        return { cycleKey: key, categoryBreakdown: agg.categoryBreakdown };
      })
    );
    const baseline = buildCategoryBaseline(baselineHistory);

    const currentTxns = await adminDb
      .collection(`users/${uid}/transactions`)
      .where("cycleKey", "==", curKey)
      .get();
    const txns: AnomalyTxn[] = currentTxns.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        date: data.date as string,
        amount:
          data.type === "expense"
            ? -(data.amount as number)
            : (data.amount as number),
        category: data.category as string,
        notes: data.notes as string | undefined,
        description: data.description as string | undefined,
      };
    });

    const knownMerchants = new Set<string>();
    for (const key of prevKeys) {
      const prevTxns = await adminDb
        .collection(`users/${uid}/transactions`)
        .where("cycleKey", "==", key)
        .get();
      for (const t of prevTxns.docs) {
        const data = t.data();
        const label = (data.notes || data.description || data.category) as
          | string
          | undefined;
        if (label) knownMerchants.add(normalizeMerchant(label));
      }
    }

    const currentAgg = await getAggregate(uid, curKey);
    const alerts = detectAnomalies({
      currentCycleBreakdown: currentAgg.categoryBreakdown,
      baseline,
      currentCycleTxns: txns,
      knownMerchants,
    });

    const significant = alerts.filter((a) => a.severity !== "low").slice(0, 5);
    if (significant.length === 0) return;

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
    }
    await batch.commit();
  },
};

// ── fetch-nav ───────────────────────────────────────────────────────────────
type NavEntry = Awaited<ReturnType<typeof fetchAmfiNav>>[number];

/** Look up NAVs for a set of scheme codes from the shared system index. */
async function lookupNavsFromIndex(
  codes: string[]
): Promise<Map<string, { nav: number; date: string }>> {
  const out = new Map<string, { nav: number; date: string }>();
  if (codes.length === 0) return out;
  const refs = codes.map((code) =>
    adminDb.doc(`system/navIndex/funds/${code}`)
  );
  const snaps = await adminDb.getAll(...refs);
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data() as { schemeCode?: string; nav?: number; date?: string };
    const code = data.schemeCode ?? snap.id;
    if (typeof data.nav === "number" && typeof data.date === "string") {
      out.set(code, { nav: data.nav, date: data.date });
    }
  }
  return out;
}

async function updateUserHoldings(
  uid: string,
  collectionName: "investments" | "mutualFunds",
  isLegacy: boolean
): Promise<void> {
  const snap = await adminDb
    .collection(`users/${uid}/${collectionName}`)
    .where("scheme_code", "!=", null)
    .get();
  if (snap.empty) return;

  const codes = snap.docs
    .map((d) => d.data().scheme_code as string | undefined)
    .filter((c): c is string => Boolean(c));
  const byCode = await lookupNavsFromIndex([...new Set(codes)]);
  if (byCode.size === 0) return;

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
    if (count % MAX_PER_BATCH === 0) await batch.commit();
  }
  await batch.commit();
}

export const fetchNavJob: CronJob<{ entries: number; date: string | null }> = {
  name: "fetch-nav",
  async prepare() {
    // Fetch the AMFI feed ONCE and write the shared system NAV index; workers
    // then read only the codes each user holds.
    const entries = await fetchAmfiNav();
    if (entries.length === 0) return { entries: 0, date: null };

    for (let i = 0; i < entries.length; i += MAX_PER_BATCH) {
      const slice = entries.slice(i, i + MAX_PER_BATCH);
      const batch = adminDb.batch();
      for (const e of slice as NavEntry[]) {
        batch.set(adminDb.doc(`system/navIndex/funds/${e.schemeCode}`), {
          schemeCode: e.schemeCode,
          schemeName: e.schemeName,
          schemeNameLower: e.schemeNameLower,
          fundHouse: e.fundHouse,
          isin: e.isin ?? null,
          nav: e.nav,
          date: e.date,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
    return { entries: entries.length, date: entries[0]?.date ?? null };
  },
  async processUser(uid, ctx) {
    if (!ctx.entries) return; // empty feed — nothing to update
    await updateUserHoldings(uid, "investments", false);
    await updateUserHoldings(uid, "mutualFunds", true);
  },
};

// ── migrate-mutual-funds (one-time) ─────────────────────────────────────────
// Folds the legacy `mutualFunds` collection into the canonical `investments`
// collection so the dual-source merge can be retired. Atomic per document
// (create native + delete legacy in one batch) and idempotent: once a legacy
// doc is moved it is gone, and the native id is deterministic (`mf_<id>`).
export const migrateMutualFundsJob: CronJob<Record<string, never>> = {
  name: "migrate-mutual-funds",
  async prepare() {
    return {};
  },
  async processUser(uid) {
    const snap = await adminDb.collection(`users/${uid}/mutualFunds`).get();
    if (snap.empty) return;

    let batch = adminDb.batch();
    let ops = 0;
    for (const mf of snap.docs) {
      const data = mf.data();
      const investmentRef = adminDb.doc(`users/${uid}/investments/mf_${mf.id}`);
      batch.set(
        investmentRef,
        {
          name:
            (data.fund_name as string) ||
            (data.name as string) ||
            "Untitled Fund",
          investment_type: "Mutual Fund",
          buy_price:
            (data.average_nav as number) || (data.buy_price as number) || 0,
          current_price:
            (data.current_nav as number) || (data.current_price as number) || 0,
          quantity: (data.units as number) || (data.quantity as number) || 0,
          sip_amount: (data.sip_amount as number) || 0,
          scheme_code: (data.scheme_code as string) ?? null,
          fund_house: (data.fund_house as string) ?? null,
          linked_goal_id: (data.linked_goal_id as string) ?? null,
          account_id: (data.account_id as string) ?? null,
          last_nav_update: (data.last_nav_update as string) ?? null,
          migrated_from: `mutualFunds/${mf.id}`,
          createdAt: data.createdAt ?? FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      batch.delete(mf.ref);
      ops += 2;
      if (ops >= MAX_PER_BATCH) {
        await batch.commit();
        batch = adminDb.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();
  },
};

export const CRON_JOBS: Record<string, CronJob> = {
  [aggregateRollupJob.name]: aggregateRollupJob as CronJob,
  [netWorthSnapshotJob.name]: netWorthSnapshotJob as CronJob,
  [anomalyScanJob.name]: anomalyScanJob as CronJob,
  [fetchNavJob.name]: fetchNavJob as CronJob,
  [migrateMutualFundsJob.name]: migrateMutualFundsJob as CronJob,
};
