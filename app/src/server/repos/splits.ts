import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  CreateSplitInput,
  SettleSplitInput,
  SplitDoc,
} from "@/schemas";
import { snapToSerialized } from "./helpers";

export async function listSplits(uid: string): Promise<SplitDoc[]> {
  const snap = await adminDb
    .collection(`users/${uid}/splits`)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => snapToSerialized<SplitDoc>(d));
}

export async function createSplit(
  uid: string,
  input: CreateSplitInput
): Promise<string> {
  const ref = await adminDb.collection(`users/${uid}/splits`).add({
    description: input.description,
    total_amount: input.total_amount,
    date: input.date,
    paid_by: input.paid_by,
    participants: input.participants,
    settled: false,
    settlements: [],
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function deleteSplit(uid: string, id: string): Promise<void> {
  await adminDb.doc(`users/${uid}/splits/${id}`).delete();
}

export async function settleSplit(
  uid: string,
  id: string,
  input: SettleSplitInput
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  await adminDb.runTransaction(async (tx) => {
    const ref = adminDb.doc(`users/${uid}/splits/${id}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Split not found");
    const data = snap.data() as SplitDoc;
    const settlements = [...(data.settlements || []), { ...input, date: today }];
    const totalSettled = settlements.reduce((sum, s) => sum + s.amount, 0);
    const settled = totalSettled >= data.total_amount;
    tx.update(ref, {
      settlements,
      settled,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}
