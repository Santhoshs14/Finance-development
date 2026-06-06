/**
 * Server-side push notification dispatch.
 *
 * `sendPush(uid, payload)` fans out to every FCM token registered for
 * the user. Tokens that fail with `unregistered` / `invalid-token`
 * are removed from Firestore automatically.
 *
 * Always best-effort: callers fire-and-forget.
 */
import { adminDb } from "@/lib/firebase-admin";
import { getMessaging, type Message } from "firebase-admin/messaging";
import { logger } from "@/lib/logger";

export interface PushPayload {
  title: string;
  body: string;
  link?: string;
  /** Optional grouping tag (replaces an existing notification with same tag). */
  tag?: string;
  /** Optional in-app notification doc data. */
  inApp?: {
    type: string;
    message?: string;
  };
}

export async function sendPush(uid: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  try {
    const snap = await adminDb.collection(`users/${uid}/fcmTokens`).get();
    if (snap.empty) return { sent: 0, failed: 0 };

    const messaging = getMessaging();
    let sent = 0;
    let failed = 0;

    await Promise.all(
      snap.docs.map(async (doc) => {
        const token = doc.data().token as string | undefined;
        if (!token) return;
        const msg: Message = {
          token,
          notification: { title: payload.title, body: payload.body },
          data: {
            link: payload.link ?? "/notifications",
            tag: payload.tag ?? "wealthflow",
          },
          webpush: {
            notification: {
              icon: "/icons/icon-192.svg",
              badge: "/icons/icon-192.svg",
              requireInteraction: false,
            },
            fcmOptions: { link: payload.link ?? "/notifications" },
          },
        };
        try {
          await messaging.send(msg);
          sent++;
        } catch (err) {
          failed++;
          const code = (err as { code?: string }).code ?? "";
          if (
            code.includes("registration-token-not-registered") ||
            code.includes("invalid-registration-token") ||
            code.includes("invalid-argument")
          ) {
            await doc.ref.delete().catch(() => {});
          } else {
            logger.warn({ event: "push.send_failed", uid, code }, err);
          }
        }
      })
    );

    return { sent, failed };
  } catch (err) {
    logger.error({ event: "push.fanout_failed", uid }, err);
    return { sent: 0, failed: 0 };
  }
}
