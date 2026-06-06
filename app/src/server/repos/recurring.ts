import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  CreateRecurringInput,
  RecurringDoc,
  UpdateRecurringInput,
} from "@/schemas";
import { snapToSerialized } from "./helpers";

export async function listRecurring(uid: string): Promise<RecurringDoc[]> {
  const snap = await adminDb
    .collection(`users/${uid}/recurring`)
    .orderBy("amount", "desc")
    .get();
  return snap.docs.map((d) => snapToSerialized<RecurringDoc>(d));
}

export async function createRecurring(
  uid: string,
  input: CreateRecurringInput
): Promise<string> {
  const ref = await adminDb.collection(`users/${uid}/recurring`).add({
    description: input.description,
    category: input.category,
    amount: input.amount,
    frequency: input.frequency,
    next_date: input.next_date,
    account_id: input.account_id ?? null,
    payment_type: input.payment_type ?? null,
    type: input.type ?? "expense",
    status: "active",
    last_executed: null,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateRecurring(
  uid: string,
  id: string,
  patch: UpdateRecurringInput
): Promise<void> {
  await adminDb
    .doc(`users/${uid}/recurring/${id}`)
    .set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function deleteRecurring(uid: string, id: string): Promise<void> {
  await adminDb.doc(`users/${uid}/recurring/${id}`).delete();
}

export function calcNextDate(
  currentDate: string,
  frequency: RecurringDoc["frequency"]
): string {
  const d = new Date(currentDate + "T00:00:00Z");
  if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (frequency === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else if (frequency === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
  const iso = d.toISOString().split("T")[0];
  // toISOString().split("T")[0] is always defined; assertion keeps TS happy under noUncheckedIndexedAccess.
  if (!iso) throw new Error("Invalid date");
  return iso;
}
