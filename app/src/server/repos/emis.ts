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
    status: input.status ?? (input.monthsPaid >= input.tenure ? "completed" : "active"),
    paidAmount: input.paidAmount ?? input.emiAmount * input.monthsPaid,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateEmi(
  uid: string,
  id: string,
  patch: UpdateEmiInput
): Promise<void> {
  const ref = adminDb.doc(`users/${uid}/emis/${id}`);
  const updates: Record<string, unknown> = { ...patch, updatedAt: FieldValue.serverTimestamp() };

  // Keep status / paidAmount in sync when months-paid advances.
  if (patch.monthsPaid !== undefined) {
    const snap = await ref.get();
    const data = snap.data() ?? {};
    const tenure = (patch.tenure ?? data.tenure ?? 0) as number;
    const emiAmount = (patch.emiAmount ?? data.emiAmount ?? 0) as number;
    if (patch.status === undefined && tenure > 0) {
      updates.status = patch.monthsPaid >= tenure ? "completed" : "active";
    }
    if (patch.paidAmount === undefined) {
      updates.paidAmount = emiAmount * patch.monthsPaid;
    }
    updates.lastPaymentDate = new Date().toISOString().split("T")[0];
  }

  await ref.set(updates, { merge: true });
}

export async function deleteEmi(uid: string, id: string): Promise<void> {
  await adminDb.doc(`users/${uid}/emis/${id}`).delete();
}
