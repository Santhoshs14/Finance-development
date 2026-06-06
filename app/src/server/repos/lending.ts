import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  CreateLendingInput,
  LendingDoc,
  RepayLendingInput,
  UpdateLendingInput,
} from "@/schemas";
import { snapToSerialized } from "./helpers";

export async function listLending(uid: string): Promise<LendingDoc[]> {
  const snap = await adminDb
    .collection(`users/${uid}/lending`)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => snapToSerialized<LendingDoc>(d));
}

export async function createLending(
  uid: string,
  input: CreateLendingInput
): Promise<string> {
  const ref = await adminDb.collection(`users/${uid}/lending`).add({
    type: input.type,
    person_name: input.person_name,
    amount: input.amount,
    paid_amount: 0,
    date: input.date,
    description: input.description ?? "",
    status: input.status ?? "pending",
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateLending(
  uid: string,
  id: string,
  patch: UpdateLendingInput
): Promise<void> {
  await adminDb
    .doc(`users/${uid}/lending/${id}`)
    .set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function deleteLending(uid: string, id: string): Promise<void> {
  await adminDb.doc(`users/${uid}/lending/${id}`).delete();
}

export async function repayLending(
  uid: string,
  id: string,
  input: RepayLendingInput
): Promise<{ paid_amount: number; status: "pending" | "partial" | "completed" }> {
  return adminDb.runTransaction(async (tx) => {
    const ref = adminDb.doc(`users/${uid}/lending/${id}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Lending record not found");
    const data = snap.data() as LendingDoc;
    const paidNow = (data.paid_amount ?? 0) + input.amount;
    const status: "pending" | "partial" | "completed" =
      paidNow >= data.amount ? "completed" : paidNow > 0 ? "partial" : "pending";
    tx.update(ref, {
      paid_amount: paidNow,
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { paid_amount: paidNow, status };
  });
}
