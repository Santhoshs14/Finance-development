/**
 * GET /api/gold/latest
 *
 * Returns the latest gold price snapshot from `system/goldPriceLatest`.
 * Cached on the client for 1 hour via the PWA runtime cache rules.
 */
import { createHandler } from "@/lib/api-handler";
import { adminDb } from "@/lib/firebase-admin";

export const GET = createHandler({ event: "gold.latest" }, async () => {
  const doc = await adminDb.doc("system/goldPriceLatest").get();
  if (!doc.exists) {
    return { available: false };
  }
  const data = doc.data() ?? {};
  return {
    available: true,
    date: data.date as string,
    inrPerGram22K: data.inrPerGram22K as number,
    inrPerGram24K: data.inrPerGram24K as number,
    source: data.source as string,
  };
});
