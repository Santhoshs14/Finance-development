import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "@/lib/logger";
import { calcNextDate } from "@/server/repos/recurring";

/**
 * POST /api/cron/recurring
 *
 * Daily cron (00:30 UTC = 6 AM IST) that:
 *   1. Finds all active recurring items due today using a collectionGroup
 *      query (single read instead of "list all users then per-user query").
 *   2. Batches per-user execution so each user pays one Firestore round-trip
 *      regardless of how many recurring items they have.
 *   3. Pre-fetches accounts per user once to avoid the previous N+1 pattern.
 *   4. Creates bill-due reminders for items due in 3 days (same scan).
 */
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

  const threeDays = new Date();
  threeDays.setDate(threeDays.getDate() + 3);
  const reminderDate = threeDays.toISOString().split("T")[0];
  if (!reminderDate) {
    return NextResponse.json({ error: "Invalid date" }, { status: 500 });
  }

  let executed = 0;
  let reminders = 0;
  let errors = 0;

  try {
    // ── 1. Find DUE recurring items in a single query across all users ──
    const dueSnap = await adminDb
      .collectionGroup("recurring")
      .where("status", "==", "active")
      .where("next_date", "<=", today)
      .get();

    // Group by uid (path: users/{uid}/recurring/{id})
    const byUser = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    for (const doc of dueSnap.docs) {
      const segments = doc.ref.path.split("/");
      const uid = segments[1];
      if (!uid) continue;
      const arr = byUser.get(uid) ?? [];
      arr.push(doc);
      byUser.set(uid, arr);
    }

    // ── 2. Execute per user ──
    for (const [uid, items] of byUser.entries()) {
      try {
        // Pre-fetch profile + all accounts in one round-trip each
        const [profileSnap, accountsSnap] = await Promise.all([
          adminDb.doc(`users/${uid}`).get(),
          adminDb.collection(`users/${uid}/accounts`).get(),
        ]);
        const cycleStartDay = (profileSnap.data()?.cycleStartDay as number) || 25;
        const accountTypes = new Map<string, string>();
        for (const acc of accountsSnap.docs) {
          accountTypes.set(acc.id, (acc.data().type as string) || "bank");
        }

        const batch = adminDb.batch();

        for (const recurringDoc of items) {
          const item = recurringDoc.data();
          const txDate = item.next_date as string;

          // Resolve cycleKey from cycleStartDay
          const [yStr, mStr, dStr] = txDate.split("-");
          const y = Number(yStr);
          const m = Number(mStr);
          const d = Number(dStr);
          let cycleMonth: number, cycleYear: number;
          if (d >= cycleStartDay) {
            cycleMonth = m === 12 ? 1 : m + 1;
            cycleYear = m === 12 ? y + 1 : y;
          } else {
            cycleMonth = m;
            cycleYear = y;
          }
          const cycleKey = `${cycleYear}-${String(cycleMonth).padStart(2, "0")}`;

          const txnRef = adminDb.collection(`users/${uid}/transactions`).doc();
          const accountId = item.account_id as string | null;
          const amount = Math.abs(item.amount as number);
          const type: "income" | "expense" = item.type === "income" ? "income" : "expense";

          batch.set(txnRef, {
            amount,
            type,
            category: item.category,
            account_id: accountId || "",
            date: txDate,
            description: item.description,
            notes: `Auto-created from recurring: ${item.description}`,
            is_recurring: true,
            recurring_frequency: item.frequency,
            cycleKey,
            createdAt: FieldValue.serverTimestamp(),
          });

          // Update account balance/liability if linked
          if (accountId && accountTypes.has(accountId)) {
            const acctType = accountTypes.get(accountId)!;
            const accountRef = adminDb.doc(`users/${uid}/accounts/${accountId}`);
            if (acctType === "credit") {
              batch.update(accountRef, {
                liability: FieldValue.increment(type === "expense" ? amount : -amount),
              });
            } else {
              const balChange = type === "expense" ? -amount : amount;
              batch.update(accountRef, { balance: FieldValue.increment(balChange) });
            }
          }

          // Update aggregate
          const aggRef = adminDb.doc(`users/${uid}/aggregates/${cycleKey}`);
          const aggUpdate: Record<string, unknown> = {
            transactionCount: FieldValue.increment(1),
            cycleKey,
            updatedAt: FieldValue.serverTimestamp(),
          };
          if (type === "expense") {
            aggUpdate.totalSpent = FieldValue.increment(amount);
            aggUpdate[`categoryBreakdown.${item.category}`] = FieldValue.increment(amount);
          } else {
            aggUpdate.totalIncome = FieldValue.increment(amount);
            aggUpdate[`categoryBreakdown.Income`] = FieldValue.increment(amount);
          }
          batch.set(aggRef, aggUpdate, { merge: true });

          // Advance the recurring doc
          batch.update(recurringDoc.ref, {
            next_date: calcNextDate(txDate, item.frequency),
            last_executed: txDate,
          });

          // Notify
          const notifRef = adminDb.collection(`users/${uid}/notifications`).doc();
          batch.set(notifRef, {
            type: "recurring_executed",
            title: "Recurring transaction executed",
            message: `${item.description} — ₹${amount.toLocaleString("en-IN")}`,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });

          executed++;
        }

        await batch.commit();
      } catch (err) {
        errors++;
        logger.error({ event: "cron.recurring.user_failed", uid }, err);
      }
    }

    // ── 3. Bill reminders for items due in 3 days ──
    const upcomingSnap = await adminDb
      .collectionGroup("recurring")
      .where("status", "==", "active")
      .where("next_date", "==", reminderDate)
      .get();

    for (const upDoc of upcomingSnap.docs) {
      try {
        const segments = upDoc.ref.path.split("/");
        const uid = segments[1];
        if (!uid) continue;
        const item = upDoc.data();
        const amount = Math.abs(item.amount as number);
        const message = `${item.description} is due in 3 days — ₹${amount.toLocaleString("en-IN")}`;

        // Idempotency: skip if a reminder for this exact message already exists today.
        const existing = await adminDb
          .collection(`users/${uid}/notifications`)
          .where("type", "==", "bill_due")
          .where("message", "==", message)
          .limit(1)
          .get();
        if (!existing.empty) continue;

        await adminDb.collection(`users/${uid}/notifications`).add({
          type: "bill_due",
          title: "Bill due soon",
          message,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
        reminders++;
      } catch (err) {
        errors++;
        logger.warn({ event: "cron.recurring.reminder_failed" }, err);
      }
    }

    logger.info({
      event: "cron.recurring.done",
      executed,
      reminders,
      errors,
      date: today,
    });

    return NextResponse.json({
      success: true,
      executed,
      reminders,
      errors,
      date: today,
    });
  } catch (err) {
    logger.error({ event: "cron.recurring.fatal" }, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
