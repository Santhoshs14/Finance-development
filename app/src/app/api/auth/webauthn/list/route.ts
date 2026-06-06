/**
 * GET /api/auth/webauthn/list — list registered passkeys.
 * DELETE /api/auth/webauthn/list?credentialId=... — remove a passkey.
 */
import { z } from "zod";
import { createHandler, errors } from "@/lib/api-handler";
import { deletePasskey, listPasskeys } from "@/lib/webauthn";
import { appendAudit } from "@/server/repos/profile";

export const GET = createHandler(
  { event: "auth.webauthn.list" },
  async ({ uid }) => {
    const items = await listPasskeys(uid);
    return {
      passkeys: items.map((p) => ({
        credentialId: p.credentialId,
        label: p.label,
        deviceType: p.deviceType,
        backedUp: p.backedUp,
        createdAt: p.createdAt?.toDate?.()?.toISOString(),
        lastUsedAt: p.lastUsedAt?.toDate?.()?.toISOString(),
      })),
    };
  }
);

const deleteQuerySchema = z.object({
  credentialId: z.string().min(1),
});

export const DELETE = createHandler(
  { event: "auth.webauthn.delete", query: deleteQuerySchema },
  async ({ uid, query }) => {
    if (!query.credentialId) throw errors.badRequest("credentialId required");
    await deletePasskey(uid, query.credentialId);
    void appendAudit(uid, "auth.passkey_deleted", {
      credentialId: query.credentialId,
    }).catch(() => {});
    return { deleted: true };
  }
);
