import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  AccountDoc,
  CreateAccountInput,
  UpdateAccountInput,
} from "@/schemas";
import { snapToSerialized } from "./helpers";

export async function listAccounts(uid: string): Promise<AccountDoc[]> {
  const snap = await adminDb
    .collection(`users/${uid}/accounts`)
    .orderBy("account_name")
    .get();
  return snap.docs.map((d) => snapToSerialized<AccountDoc>(d));
}

export async function createAccount(
  uid: string,
  input: CreateAccountInput
): Promise<string> {
  const data: Record<string, unknown> = {
    account_name: input.account_name,
    type: input.type,
    balance: input.balance ?? 0,
    createdAt: FieldValue.serverTimestamp(),
  };
  if (input.type === "credit") {
    data.credit_limit = input.credit_limit ?? 0;
    data.liability = input.liability ?? 0;
    if (input.shared_limit_with) data.shared_limit_with = input.shared_limit_with;
    if (input.billing_cycle_start_day !== undefined)
      data.billing_cycle_start_day = input.billing_cycle_start_day;
    if (input.due_days_after !== undefined) data.due_days_after = input.due_days_after;
  }
  if (input.account_type) data.account_type = input.account_type;

  const ref = await adminDb.collection(`users/${uid}/accounts`).add(data);
  return ref.id;
}

export async function updateAccount(
  uid: string,
  id: string,
  patch: UpdateAccountInput
): Promise<void> {
  await adminDb
    .doc(`users/${uid}/accounts/${id}`)
    .set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function deleteAccount(uid: string, id: string): Promise<void> {
  await adminDb.doc(`users/${uid}/accounts/${id}`).delete();
}

/** Recompute account balance/liability from its transactions. */
export async function recalcAccount(uid: string, accountId: string): Promise<{ balance: number; liability: number }> {
  const accountRef = adminDb.doc(`users/${uid}/accounts/${accountId}`);
  const accountSnap = await accountRef.get();
  if (!accountSnap.exists) {
    throw new Error("Account not found");
  }
  const accountType = (accountSnap.data()?.type as string) || "bank";

  const txSnap = await adminDb
    .collection(`users/${uid}/transactions`)
    .where("account_id", "==", accountId)
    .get();

  let total = 0;
  for (const doc of txSnap.docs) {
    const data = doc.data();
    const amt = Math.abs(Number(data.amount) || 0);
    if (data.type === "expense") total -= amt;
    else if (data.type === "income") total += amt;
  }

  if (accountType === "credit") {
    const liability = total < 0 ? -total : 0;
    await accountRef.update({ liability });
    return { balance: 0, liability };
  } else {
    await accountRef.update({ balance: total });
    return { balance: total, liability: 0 };
  }
}
