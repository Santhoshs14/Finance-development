import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "@/lib/logger";
import { calcNextDate } from "@/server/repos/recurring";
import { getFinancialCycleForDate } from "@/utils/financialMonth";

export interface SipNav {
  nav: number;
  date: string;
}

export interface SipExecutionResult {
  status: "executed" | "skipped";
  reason?: string;
  units?: number;
  nav?: number;
  navDate?: string;
}

/**
 * Read the latest NAV for a scheme from the shared `system/navIndex` index
 * (written daily by the fetch-nav cron). On non-business days this is the most
 * recent published NAV; the SIP records which `date` it used.
 */
export async function lookupSchemeNav(
  schemeCode: string
): Promise<SipNav | null> {
  if (!schemeCode) return null;
  const snap = await adminDb.doc(`system/navIndex/funds/${schemeCode}`).get();
  if (!snap.exists) return null;
  const data = snap.data() as { nav?: number; date?: string };
  if (typeof data.nav !== "number" || !(data.nav > 0)) return null;
  return { nav: data.nav, date: typeof data.date === "string" ? data.date : "" };
}

/**
 * Execute a single SIP installment atomically:
 *   1. buy `amount / NAV` units of the linked holding (weighted-average cost),
 *   2. deduct the cash from the funding account (credit cards add to liability),
 *   3. record a signed Investment expense transaction + cycle aggregate,
 *   4. advance the SIP schedule (next_date + counters),
 *   5. notify the user.
 *
 * Idempotent: a second run for the same `today` is a no-op (guarded by
 * `last_executed`), so QStash/Vercel retries are safe.
 */
export async function executeSip(opts: {
  uid: string;
  sipId: string;
  today: string;
  cycleStartDay: number;
  nav: SipNav;
}): Promise<SipExecutionResult> {
  const { uid, sipId, today, cycleStartDay, nav } = opts;

  return adminDb.runTransaction(async (tx) => {
    // ── Reads (all before writes, per Firestore transaction rules) ──
    const sipRef = adminDb.doc(`users/${uid}/sips/${sipId}`);
    const sipSnap = await tx.get(sipRef);
    if (!sipSnap.exists) return { status: "skipped", reason: "sip-missing" };
    const sip = sipSnap.data()!;
    if (sip.status !== "active") return { status: "skipped", reason: "not-active" };
    if (sip.last_executed === today) {
      return { status: "skipped", reason: "already-run" };
    }

    const amount = Math.abs(Number(sip.amount) || 0);
    if (amount <= 0) return { status: "skipped", reason: "invalid-amount" };
    const units = amount / nav.nav;

    const investmentId = (sip.investment_id as string | null) || null;
    const invRef = investmentId
      ? adminDb.doc(`users/${uid}/investments/${investmentId}`)
      : adminDb.collection(`users/${uid}/investments`).doc();
    const invSnap = investmentId ? await tx.get(invRef) : null;

    const accountId = (sip.account_id as string | null) || null;
    const acctRef = accountId
      ? adminDb.doc(`users/${uid}/accounts/${accountId}`)
      : null;
    const acctSnap = acctRef ? await tx.get(acctRef) : null;

    // ── Writes ──
    const { cycleKey } = getFinancialCycleForDate(today, cycleStartDay);

    // 1. Holding — weighted-average cost.
    if (invSnap && invSnap.exists) {
      const inv = invSnap.data()!;
      const oldQty = Number(inv.quantity) || 0;
      const oldBuy = Number(inv.buy_price) || 0;
      const newQty = oldQty + units;
      const newBuy = newQty > 0 ? (oldQty * oldBuy + amount) / newQty : nav.nav;
      tx.update(invRef, {
        quantity: newQty,
        buy_price: newBuy,
        current_price: nav.nav,
        last_nav_update: nav.date,
        nav_date: nav.date,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(invRef, {
        name: sip.fund_name,
        investment_type: "Mutual Fund",
        scheme_code: sip.scheme_code,
        fund_house: sip.fund_house ?? null,
        buy_price: nav.nav,
        current_price: nav.nav,
        quantity: units,
        sip_amount: amount,
        account_id: accountId,
        linked_goal_id: sip.linked_goal_id ?? null,
        last_nav_update: nav.date,
        nav_date: nav.date,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // 2. Funding account balance / credit liability.
    if (acctRef && acctSnap && acctSnap.exists) {
      const isCredit = acctSnap.data()?.type === "credit";
      tx.update(
        acctRef,
        isCredit
          ? { liability: FieldValue.increment(amount) }
          : { balance: FieldValue.increment(-amount) }
      );
    }

    // 3. Investment expense transaction (signed negative, like the rest of app).
    const txnRef = adminDb.collection(`users/${uid}/transactions`).doc();
    tx.set(txnRef, {
      amount: -amount,
      type: "expense",
      category: "Investment",
      account_id: accountId || "",
      date: today,
      description: `SIP — ${sip.fund_name}`,
      notes: `SIP: ${units.toFixed(4)} units @ ₹${nav.nav} (NAV ${nav.date})`,
      payment_type: "",
      is_recurring: true,
      recurring_frequency: sip.frequency,
      is_sip: true,
      sip_id: sipId,
      linked_investment_id: invRef.id,
      cycleKey,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 4. Cycle aggregate (mirror the recurring/transactions convention).
    const aggRef = adminDb.doc(`users/${uid}/aggregates/${cycleKey}`);
    const aggUpdate: Record<string, unknown> = {
      transactionCount: FieldValue.increment(1),
      totalSpent: FieldValue.increment(amount),
      cycleKey,
      updatedAt: FieldValue.serverTimestamp(),
    };
    aggUpdate["categoryBreakdown.Investment"] = FieldValue.increment(amount);
    tx.set(aggRef, aggUpdate, { merge: true });

    // 5. Advance the SIP schedule.
    tx.update(sipRef, {
      investment_id: invRef.id,
      next_date: calcNextDate(sip.next_date as string, sip.frequency),
      last_executed: today,
      installments_done: FieldValue.increment(1),
      total_invested: FieldValue.increment(amount),
      total_units: FieldValue.increment(units),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 6. Notify.
    const notifRef = adminDb.collection(`users/${uid}/notifications`).doc();
    tx.set(notifRef, {
      type: "sip_executed",
      title: "SIP invested",
      message: `${sip.fund_name} — ₹${amount.toLocaleString("en-IN")} → ${units.toFixed(3)} units`,
      link: "/investments/mutual-funds",
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { status: "executed", units, nav: nav.nav, navDate: nav.date };
  });
}

/**
 * Find and execute every active SIP due on or before `today`, grouped per user.
 * NAV lookups are cached per scheme. A single SIP's failure is logged and
 * skipped so the rest still run.
 */
export async function runDueSips(
  today: string
): Promise<{ executed: number; skipped: number; errors: number }> {
  let executed = 0;
  let skipped = 0;
  let errors = 0;

  const dueSnap = await adminDb
    .collectionGroup("sips")
    .where("status", "==", "active")
    .where("next_date", "<=", today)
    .get();

  const byUser = new Map<string, { id: string; scheme_code: string }[]>();
  for (const doc of dueSnap.docs) {
    const uid = doc.ref.path.split("/")[1];
    if (!uid) continue;
    const arr = byUser.get(uid) ?? [];
    arr.push({ id: doc.id, scheme_code: (doc.data().scheme_code as string) || "" });
    byUser.set(uid, arr);
  }

  const navCache = new Map<string, SipNav | null>();
  const navFor = async (code: string): Promise<SipNav | null> => {
    if (navCache.has(code)) return navCache.get(code)!;
    const n = await lookupSchemeNav(code);
    navCache.set(code, n);
    return n;
  };

  for (const [uid, items] of byUser.entries()) {
    let cycleStartDay = 25;
    try {
      const profileSnap = await adminDb.doc(`users/${uid}`).get();
      cycleStartDay = (profileSnap.data()?.cycleStartDay as number) || 25;
    } catch {
      /* default cycle start day */
    }

    for (const item of items) {
      try {
        const nav = await navFor(item.scheme_code);
        if (!nav) {
          skipped++;
          logger.warn({
            event: "cron.sip.no_nav",
            uid,
            sip: item.id,
            scheme: item.scheme_code,
          });
          continue;
        }
        const res = await executeSip({
          uid,
          sipId: item.id,
          today,
          cycleStartDay,
          nav,
        });
        if (res.status === "executed") executed++;
        else skipped++;
      } catch (err) {
        errors++;
        logger.error({ event: "cron.sip.exec_failed", uid, sip: item.id }, err);
      }
    }
  }

  logger.info({ event: "cron.sip.done", executed, skipped, errors, date: today });
  return { executed, skipped, errors };
}

/** Run a single SIP immediately ("Invest now"). */
export async function executeSipNow(
  uid: string,
  sipId: string
): Promise<SipExecutionResult> {
  const sipSnap = await adminDb.doc(`users/${uid}/sips/${sipId}`).get();
  if (!sipSnap.exists) return { status: "skipped", reason: "sip-missing" };
  const sip = sipSnap.data()!;
  const nav = await lookupSchemeNav(sip.scheme_code as string);
  if (!nav) return { status: "skipped", reason: "no-nav" };
  const profileSnap = await adminDb.doc(`users/${uid}`).get();
  const cycleStartDay = (profileSnap.data()?.cycleStartDay as number) || 25;
  const today = new Date().toISOString().split("T")[0]!;
  return executeSip({ uid, sipId, today, cycleStartDay, nav });
}
