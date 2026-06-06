import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  CreateNotificationInput,
  NotificationDoc,
} from "@/schemas";
import { snapToSerialized } from "./helpers";

export async function listNotifications(
  uid: string,
  limit = 50
): Promise<NotificationDoc[]> {
  const snap = await adminDb
    .collection(`users/${uid}/notifications`)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => snapToSerialized<NotificationDoc>(d));
}

export async function createNotification(
  uid: string,
  input: CreateNotificationInput
): Promise<string> {
  const ref = await adminDb.collection(`users/${uid}/notifications`).add({
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.link,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function markRead(uid: string, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const batch = adminDb.batch();
  for (const id of ids.slice(0, 50)) {
    batch.update(adminDb.doc(`users/${uid}/notifications/${id}`), { read: true });
  }
  await batch.commit();
  return Math.min(ids.length, 50);
}

export async function markAllRead(uid: string): Promise<number> {
  const snap = await adminDb
    .collection(`users/${uid}/notifications`)
    .where("read", "==", false)
    .get();
  if (snap.empty) return 0;
  const batch = adminDb.batch();
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
  return snap.size;
}

export async function deleteNotifications(uid: string, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const batch = adminDb.batch();
  for (const id of ids.slice(0, 50)) {
    batch.delete(adminDb.doc(`users/${uid}/notifications/${id}`));
  }
  await batch.commit();
  return Math.min(ids.length, 50);
}

export async function clearAllNotifications(uid: string): Promise<number> {
  const snap = await adminDb.collection(`users/${uid}/notifications`).get();
  if (snap.empty) return 0;
  const batch = adminDb.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}
