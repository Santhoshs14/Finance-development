import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

const TTL_MS = 24 * 60 * 60 * 1000;
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export type IdempotencyLookup =
  | { state: "disabled" }
  | { state: "claimed"; key: string }
  | { state: "in_flight" }
  | { state: "replay"; status: number; body: unknown };

function ref(uid: string, key: string) {
  return adminDb.doc(`users/${uid}/_idempotency/${key}`);
}

/**
 * Reserve an idempotency key for this request. A create() is used so two
 * concurrent retries race on the same document and exactly one wins.
 */
export async function claimIdempotencyKey(
  uid: string,
  rawKey: string | null
): Promise<IdempotencyLookup> {
  if (!uid || !rawKey) return { state: "disabled" };

  const key = rawKey.trim();
  if (!KEY_PATTERN.test(key)) return { state: "disabled" };

  try {
    await ref(uid, key).create({
      status: "in_flight",
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + TTL_MS),
    });
    return { state: "claimed", key };
  } catch {
    const snap = await ref(uid, key).get();
    const data = snap.data();
    if (!data) return { state: "disabled" };
    if (data.status === "completed") {
      return {
        state: "replay",
        status: Number(data.responseStatus) || 200,
        body: data.responseBody ?? null,
      };
    }
    return { state: "in_flight" };
  }
}

export async function completeIdempotencyKey(
  uid: string,
  key: string,
  status: number,
  body: unknown
): Promise<void> {
  await ref(uid, key).set(
    {
      status: "completed",
      responseStatus: status,
      responseBody: body ?? null,
      completedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + TTL_MS),
    },
    { merge: true }
  );
}

/** A failed request must not be replayed as a success. */
export async function releaseIdempotencyKey(uid: string, key: string): Promise<void> {
  await ref(uid, key).delete();
}
