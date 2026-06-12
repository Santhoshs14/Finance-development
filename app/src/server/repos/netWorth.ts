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
