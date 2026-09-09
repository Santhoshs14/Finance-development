import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { logger } from "@/lib/logger";
import type { SyncCollection } from "./collections";

/**
 * WriteBatch and Transaction both expose set(), but their overloads do not
 * unify, so callers pass whichever they hold through this narrow shape.
 */
interface Writer {
  set(ref: DocumentReference, data: Record<string, unknown>, options?: { merge: boolean }): unknown;
}

/**
 * The client watches this single document instead of one listener per
 * collection. Any bump tells it to pull deltas from /api/sync.
 */
function beaconRef(uid: string) {
  return adminDb.doc(`users/${uid}/_sync/state`);
}

function tombstoneRef(uid: string, collection: string, docId: string) {
  return adminDb.doc(`users/${uid}/_tombstones/${collection}__${docId}`);
}

/** Best-effort: a failed beacon bump must never fail the mutation itself. */
export async function bumpSync(uid: string, collection: SyncCollection): Promise<void> {
  try {
    await beaconRef(uid).set(
      {
        lastChangeAt: FieldValue.serverTimestamp(),
        [`collections.${collection}`]: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    logger.warn({ event: "sync.beacon_failed", uid, collection }, err);
  }
}

/** Same as bumpSync, enlisted in an existing batch or transaction. */
export function bumpSyncIn(
  writer: Writer,
  uid: string,
  collection: SyncCollection
): void {
  writer.set(
    beaconRef(uid),
    {
      lastChangeAt: FieldValue.serverTimestamp(),
      [`collections.${collection}`]: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Record a deletion so the delta feed can tell clients to drop the row.
 * Without this an offline client would keep a document forever.
 */
export function recordTombstoneIn(
  writer: Writer,
  uid: string,
  collection: SyncCollection,
  docId: string
): void {
  writer.set(tombstoneRef(uid, collection, docId), {
    collection,
    docId,
    deletedAt: FieldValue.serverTimestamp(),
  });
}

export async function recordTombstone(
  uid: string,
  collection: SyncCollection,
  docId: string
): Promise<void> {
  try {
    await tombstoneRef(uid, collection, docId).set({
      collection,
      docId,
      deletedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.warn({ event: "sync.tombstone_failed", uid, collection, docId }, err);
  }
}

/**
 * Delete a document and leave a tombstone in the same batch. Without the
 * tombstone a replicated client would keep showing the row forever.
 */
export async function deleteWithTombstone(
  uid: string,
  collection: SyncCollection,
  docId: string
): Promise<void> {
  const batch = adminDb.batch();
  batch.delete(adminDb.doc(`users/${uid}/${collection}/${docId}`));
  recordTombstoneIn(batch, uid, collection, docId);
  bumpSyncIn(batch, uid, collection);
  await batch.commit();
}
