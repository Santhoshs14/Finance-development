/**
 * POST /api/cron/net-worth-snapshot
 *
 * Monthly cron (Vercel: `0 18 1 * *` — 1st of month, 18:00 UTC) that records
 * a net-worth snapshot for every user so the trend chart on
 * `/wealth/net-worth` always has a data point per month.
 *
 * Net worth is computed server-side using the same formula as the client
 * `calculateNetWorth` util:
 *   net_worth = bankBalance + investmentValue + lent − ccOutstanding − borrowed
 *
 * Investment value is read from BOTH the canonical `investments` collection
 * (current_price × quantity) and the legacy `mutualFunds` collection
 * (current_nav × units), matching how the app merges the two.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { saveNetWorthSnapshot } from "@/server/repos/netWorth";

const r = (v: number) => Math.round(v * 100) / 100;

function num(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

async function computeUserNetWorth(uid: string) {
  const [accountsSnap, investmentsSnap, mutualFundsSnap, lendingSnap] =
    await Promise.all([
      adminDb.collection(`users/${uid}/accounts`).get(),
      adminDb.collection(`users/${uid}/investments`).get(),
      adminDb.collection(`users/${uid}/mutualFunds`).get(),
      adminDb.collection(`users/${uid}/lending`).get(),
    ]);

  let bankBalance = 0;
  let ccOutstanding = 0;
  for (const doc of accountsSnap.docs) {
    const a = doc.data();
    if (a.type === "credit") {
      ccOutstanding += num(a.liability);
    } else {
      bankBalance += num(a.balance);
    }
  }

  let investmentValue = 0;
  for (const doc of investmentsSnap.docs) {
    const inv = doc.data();
    const byUnits = num(inv.current_price) * num(inv.quantity);
    investmentValue += byUnits || num(inv.current_value) || num(inv.value);
  }
  for (const doc of mutualFundsSnap.docs) {
    const mf = doc.data();
    const byUnits = num(mf.current_nav) * num(mf.units);
    investmentValue +=
      byUnits || num(mf.current_value) || num(mf.invested_amount);
  }

  let lent = 0;
  let borrowed = 0;
  for (const doc of lendingSnap.docs) {
    const l = doc.data();
    if (l.status === "paid") continue;
    const outstanding = num(l.amount) - num(l.paid_amount);
    if (l.type === "lent") lent += outstanding;
    else if (l.type === "borrowed") borrowed += outstanding;
  }

  return {
    accounts: r(bankBalance),
    investments: r(investmentValue),
    cc_outstanding: r(ccOutstanding),
    lent: r(lent),
    borrowed: r(borrowed),
    net_worth: r(
      bankBalance + investmentValue + lent - ccOutstanding - borrowed
    ),
  };
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  let snapshots = 0;
  let errors = 0;

  try {
    const usersSnap = await adminDb.collection("users").select().get();

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      try {
        const totals = await computeUserNetWorth(uid);
        await saveNetWorthSnapshot(uid, { month, ...totals });
        snapshots++;
      } catch (err) {
        errors++;
        logger.warn({ event: "cron.net_worth_snapshot.user_failed", uid, month }, err);
      }
    }

    logger.info({ event: "cron.net_worth_snapshot.done", month, snapshots, errors });
    return NextResponse.json({ month, snapshots, errors });
  } catch (err) {
    logger.error({ event: "cron.net_worth_snapshot.fatal" }, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
