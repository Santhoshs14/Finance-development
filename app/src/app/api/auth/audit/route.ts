/**
 * GET /api/auth/audit
 * Returns the current user's recent audit log entries.
 */
import { createHandler } from "@/lib/api-handler";
import { listAudit } from "@/server/repos/profile";

export const GET = createHandler(
  { event: "auth.audit.list" },
  async ({ uid }) => {
    const items = await listAudit(uid, 100);
    return { audit: items };
  }
);
