import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { BudgetDoc, CreateBudgetInput, UpdateBudgetInput } from "@/schemas";
import { snapToSerialized } from "./helpers";

export async function listBudgets(
  uid: string,
  cycleKey: string
): Promise<BudgetDoc[]> {
  const snap = await adminDb
    .collection(`users/${uid}/budgetSnapshots/${cycleKey}/categories`)
    .get();
  return snap.docs.map((d) => snapToSerialized<BudgetDoc>(d));
}

export async function createBudget(
  uid: string,
  input: CreateBudgetInput
): Promise<string> {
  const ref = await adminDb
    .collection(`users/${uid}/budgetSnapshots/${input.cycleKey}/categories`)
    .add({
      category: input.category,
      monthly_limit: input.monthly_limit,
      createdAt: FieldValue.serverTimestamp(),
    });
  return ref.id;
}

export async function updateBudget(
  uid: string,
  cycleKey: string,
  id: string,
  patch: UpdateBudgetInput
): Promise<void> {
  await adminDb
    .doc(`users/${uid}/budgetSnapshots/${cycleKey}/categories/${id}`)
    .set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function deleteBudget(
  uid: string,
  cycleKey: string,
  id: string
): Promise<void> {
  await adminDb
    .doc(`users/${uid}/budgetSnapshots/${cycleKey}/categories/${id}`)
    .delete();
}
