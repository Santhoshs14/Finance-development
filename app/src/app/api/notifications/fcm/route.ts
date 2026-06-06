/**
 * POST /api/notifications/fcm   — register a device token
 * DELETE /api/notifications/fcm — remove a device token
 */
import { z } from "zod";
import { createHandler, errors } from "@/lib/api-handler";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { createHash } from "crypto";

const registerBodySchema = z.object({
  token: z.string().min(20).max(2000),
  label: z.string().min(1).max(60).default("Web"),
});

const deleteQuerySchema = z.object({
  token: z.string().min(20).max(2000),
});

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 24);
}

export const POST = createHandler(
  { event: "notifications.fcm.register", body: registerBodySchema },
  async ({ uid, body }) => {
    const id = tokenHash(body.token);
    await adminDb.doc(`users/${uid}/fcmTokens/${id}`).set({
      token: body.token,
      label: body.label,
      createdAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(),
    });
    return { id };
  }
);

export const DELETE = createHandler(
  { event: "notifications.fcm.delete", query: deleteQuerySchema },
  async ({ uid, query }) => {
    if (!query.token) throw errors.badRequest("token required");
    const id = tokenHash(query.token);
    await adminDb.doc(`users/${uid}/fcmTokens/${id}`).delete();
    return { deleted: true };
  }
);
