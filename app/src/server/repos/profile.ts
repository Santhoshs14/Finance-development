import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { ProfileDoc, UpdateProfileInput } from "@/schemas";
import { logger } from "@/lib/logger";
import { snapToSerialized } from "./helpers";

const ROOT_FIELDS_TO_MIRROR = [
  "cycleStartDay",
  "monthlySalary",
  "onboardingComplete",
  "displayName",
  "currency",
  "notificationPrefs",
] as const;

export async function getProfile(uid: string): Promise<ProfileDoc> {
  const settingsDoc = await adminDb.doc(`users/${uid}/profile/settings`).get();
  const rootDoc = await adminDb.doc(`users/${uid}`).get();

  const settings = (settingsDoc.exists ? settingsDoc.data() : {}) as Partial<ProfileDoc>;
  const root = (rootDoc.exists ? rootDoc.data() : {}) as Partial<ProfileDoc>;

  return {
    cycleStartDay: settings.cycleStartDay ?? root.cycleStartDay ?? 25,
    monthlySalary: settings.monthlySalary ?? root.monthlySalary ?? 0,
    onboardingComplete:
      settings.onboardingComplete ?? root.onboardingComplete ?? false,
    displayName: settings.displayName ?? root.displayName,
    currency: settings.currency ?? root.currency ?? "INR",
    notificationPrefs: settings.notificationPrefs ?? root.notificationPrefs,
  };
}

export async function updateProfile(
  uid: string,
  patch: UpdateProfileInput
): Promise<void> {
  const updates: Record<string, unknown> = { ...patch, updatedAt: FieldValue.serverTimestamp() };

  // Mirror onto root user doc (DataProvider listens there for real-time).
  const rootPatch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  for (const key of ROOT_FIELDS_TO_MIRROR) {
    if (patch[key] !== undefined) rootPatch[key] = patch[key];
  }

  const batch = adminDb.batch();
  batch.set(adminDb.doc(`users/${uid}/profile/settings`), updates, { merge: true });
  batch.set(adminDb.doc(`users/${uid}`), rootPatch, { merge: true });
  await batch.commit();
}

/** Cascade-delete all subcollections and the root user doc. */
export async function deleteUserData(uid: string): Promise<void> {
  const userRoot = adminDb.doc(`users/${uid}`);

  // Enumerated at runtime so newly added subcollections can never be missed.
  const collections = await userRoot.listCollections();
  for (const col of collections) {
    await adminDb.recursiveDelete(col);
  }
  await userRoot.delete();
}

/** Best-effort: audit writes must never fail the request that triggered them. */
export async function appendAudit(
  uid: string,
  event: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await adminDb.collection(`users/${uid}/audit`).add({
      event,
      details: details ?? null,
      at: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.warn({ event: "audit.append_failed", uid, auditEvent: event }, err);
  }
}

export async function listAudit(uid: string, limit = 50) {
  const snap = await adminDb
    .collection(`users/${uid}/audit`)
    .orderBy("at", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => snapToSerialized(d));
}
