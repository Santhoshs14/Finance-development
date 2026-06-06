import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  NetWorthSnapshotDoc,
  SaveNetWorthSnapshotInput,
} from "@/schemas";
import { snapToSerialized } from "./helpers";

export async function listNetWorthSnapshots(
  uid: string,
  limit = 12
): Promise<NetWorthSnapshotDoc[]> {
  const snap = await adminDb
    .collection(`users/${uid}/netWorthSnapshots`)
    .orderBy("date", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => snapToSerialized<NetWorthSnapshotDoc>(d));
}

export async function saveNetWorthSnapshot(
  uid: string,
  input: SaveNetWorthSnapshotInput
): Promise<string> {
  // Replace existing snapshot for the same date (idempotent monthly run).
  const existing = await adminDb
    .collection(`users/${uid}/netWorthSnapshots`)
    .where("date", "==", input.date)
    .limit(1)
    .get();

  if (!existing.empty && existing.docs[0]) {
    const ref = existing.docs[0].ref;
    await ref.set(
      { ...input, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    return ref.id;
  }

  const ref = await adminDb.collection(`users/${uid}/netWorthSnapshots`).add({
    ...input,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}
