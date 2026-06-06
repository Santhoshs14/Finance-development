import { adminDb } from "@/lib/firebase-admin";
import type {
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";

/** Project a Firestore snapshot to a plain object with `id`. */
export function snapToDoc<T extends Record<string, unknown>>(
  snap: QueryDocumentSnapshot | DocumentSnapshot
): T & { id: string } {
  return { id: snap.id, ...(snap.data() as T) };
}

/** Serialize a Firestore Timestamp (or pass-through). */
export function serializeTimestamp(value: unknown): string | unknown {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return value;
}

/** Project a snapshot and serialize all Timestamp-shaped fields. */
export function snapToSerialized<T extends Record<string, unknown>>(
  snap: QueryDocumentSnapshot | DocumentSnapshot
): T & { id: string } {
  const data = snap.data() as Record<string, unknown> | undefined;
  const out: Record<string, unknown> = { id: snap.id };
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      out[k] = serializeTimestamp(v);
    }
  }
  return out as T & { id: string };
}

/** Resolve the user's `cycleStartDay` (1-28, default 25). */
export async function getCycleStartDay(uid: string): Promise<number> {
  const profileDoc = await adminDb.doc(`users/${uid}`).get();
  if (profileDoc.exists) {
    const day = profileDoc.data()?.cycleStartDay;
    if (typeof day === "number" && day >= 1 && day <= 28) return day;
  }
  return 25;
}

/** Lower-cased SHA-256 hash, used for dedup keys. */
export async function sha256(input: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(input).digest("hex");
}
