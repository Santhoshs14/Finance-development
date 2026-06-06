import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { CreateEmiInput, EmiDoc, UpdateEmiInput } from "@/schemas";
import { snapToSerialized } from "./helpers";

export async function listEmis(uid: string): Promise<EmiDoc[]> {
  const snap = await adminDb
    .collection(`users/${uid}/emis`)
    .orderBy("startDate", "desc")
    .get();
  return snap.docs.map((d) => snapToSerialized<EmiDoc>(d));
}

export async function createEmi(uid: string, input: CreateEmiInput): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const ref = await adminDb.collection(`users/${uid}/emis`).add({
    cardId: input.cardId ?? null,
    description: input.description,
    totalAmount: input.totalAmount,
    emiAmount: input.emiAmount,
    tenure: input.tenure,
    monthsPaid: input.monthsPaid,
    interestRate: input.interestRate,
    startDate: input.startDate ?? today,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateEmi(
  uid: string,
  id: string,
  patch: UpdateEmiInput
): Promise<void> {
  await adminDb
    .doc(`users/${uid}/emis/${id}`)
    .set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function deleteEmi(uid: string, id: string): Promise<void> {
  await adminDb.doc(`users/${uid}/emis/${id}`).delete();
}
