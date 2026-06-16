import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  NetWorthSnapshotDoc,
  SaveNetWorthSnapshotInput,
} from "@/schemas";
import { snapToSerialized } from "./helpers";

const r = (v: number) => Math.round(v * 100) / 100;

function num(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Compute a user's net worth from their accounts, investments (canonical +
 * legacy mutualFunds), and lending records — the same formula the client
 * `calculateNetWorth` util uses:
 *   net_worth = bankBalance + investmentValue + lent − ccOutstanding − borrowed
 */
export async function computeUserNetWorth(
  uid: string
): Promise<Omit<SaveNetWorthSnapshotInput, "month">> {
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

export async function listNetWorthSnapshots(
  uid: string,
  limit = 12
): Promise<NetWorthSnapshotDoc[]> {
  const snap = await adminDb
    .collection(`users/${uid}/netWorthSnapshots`)
    .orderBy("month", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => snapToSerialized<NetWorthSnapshotDoc>(d));
}

export async function saveNetWorthSnapshot(
  uid: string,
  input: SaveNetWorthSnapshotInput
): Promise<string> {
  // Keyed by month ("YYYY-MM") so the monthly run is idempotent — re-running
  // for the same month overwrites rather than duplicating.
  const ref = adminDb.doc(`users/${uid}/netWorthSnapshots/${input.month}`);
  const existing = await ref.get();
  await ref.set(
    {
      ...input,
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return ref.id;
}
