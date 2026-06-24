import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { CreateSipInput, SipDoc, UpdateSipInput } from "@/schemas";
import { snapToSerialized } from "./helpers";

export async function listSips(uid: string): Promise<SipDoc[]> {
  const snap = await adminDb
    .collection(`users/${uid}/sips`)
    .orderBy("next_date", "asc")
    .get();
  return snap.docs.map((d) => snapToSerialized<SipDoc>(d));
}

export async function createSip(
  uid: string,
  input: CreateSipInput
): Promise<string> {
  const ref = await adminDb.collection(`users/${uid}/sips`).add({
    investment_id: input.investment_id ?? null,
    scheme_code: input.scheme_code,
    fund_name: input.fund_name,
    fund_house: input.fund_house ?? null,
    amount: input.amount,
    frequency: input.frequency,
    day_of_month: input.day_of_month ?? null,
    next_date: input.next_date,
    account_id: input.account_id,
    linked_goal_id: input.linked_goal_id ?? null,
    status: "active",
    last_executed: null,
    installments_done: 0,
    total_invested: 0,
    total_units: 0,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateSip(
  uid: string,
  id: string,
  patch: UpdateSipInput
): Promise<void> {
  await adminDb
    .doc(`users/${uid}/sips/${id}`)
    .set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function deleteSip(uid: string, id: string): Promise<void> {
  await adminDb.doc(`users/${uid}/sips/${id}`).delete();
}
