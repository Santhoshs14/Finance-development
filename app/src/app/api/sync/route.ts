import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  SYNC_COLLECTIONS,
  isSyncCollection,
  type SyncCollection,
} from "@/server/sync/collections";

export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE_SIZE = 500;

function toMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return null;
}

/** Firestore Timestamps are not JSON-serialisable; send epoch millis. */
function serialise(id: string, data: Record<string, unknown>) {
  const out: Record<string, unknown> = { id };
  for (const [key, value] of Object.entries(data)) {
    const millis = toMillis(value);
    out[key] = millis === null ? value : millis;
  }
  return out;
}

/** `after` is `collection:lastDocId` pairs, resuming a paged full sync. */
function parseAfter(raw: string | null): Map<SyncCollection, string> {
  const map = new Map<SyncCollection, string>();
  if (!raw) return map;
  for (const pair of raw.split(",")) {
    const [collection, docId] = pair.split(":");
    if (collection && docId && isSyncCollection(collection)) {
      map.set(collection, docId);
    }
  }
  return map;
}

/**
 * GET /api/sync?since=<epochMillis>&after=<collection:docId,...>
 *
 * Omitting `since` performs a full snapshot, paged per collection via `after`
 * so a long transaction history loads completely rather than being truncated.
 * A full snapshot also picks up documents written before `updatedAt` existed.
 * With `since`, only documents touched after that instant are returned.
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const rl = await rateLimit({ key: `sync:${uid}`, limit: 120, windowSec: 60 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const sinceRaw = Number(searchParams.get("since") ?? 0);
  const since = Number.isFinite(sinceRaw) && sinceRaw > 0 ? sinceRaw : 0;
  const isFullSync = since === 0;
  const after = parseAfter(searchParams.get("after"));

  const requested = searchParams.get("collections");
  const allCollections = requested
    ? requested.split(",").map((c) => c.trim()).filter(isSyncCollection)
    : [...SYNC_COLLECTIONS];

  // On a resumed page, only revisit collections that still had more to give.
  const collections =
    isFullSync && after.size > 0
      ? allCollections.filter((c) => after.has(c))
      : allCollections;

  try {
    const changes: Record<string, unknown[]> = {};
    const nextAfter: Record<string, string> = {};
    let maxSeen = since;

    await Promise.all(
      collections.map(async (collection) => {
        const base = adminDb.collection(`users/${uid}/${collection}`);

        let query = isFullSync
          ? base.orderBy("__name__").limit(PAGE_SIZE)
          : base
              .where("updatedAt", ">", Timestamp.fromMillis(since))
              .orderBy("updatedAt")
              .limit(PAGE_SIZE);

        const resumeFrom = after.get(collection);
        if (isFullSync && resumeFrom) query = query.startAfter(resumeFrom);

        const snap = await query.get();
        if (snap.empty) return;

        changes[collection] = snap.docs.map((doc) => serialise(doc.id, doc.data()));

        for (const doc of snap.docs) {
          const updated = toMillis(doc.data().updatedAt);
          if (updated && updated > maxSeen) maxSeen = updated;
        }

        if (snap.size >= PAGE_SIZE) {
          nextAfter[collection] = isFullSync
            ? snap.docs[snap.size - 1].id
            : // Incremental pages advance by cursor, not by document id.
              "";
        }
      })
    );

    // Tombstones tell the client which rows to drop locally.
    let deletions: { collection: string; docId: string; deletedAt: number | null }[] = [];
    let moreDeletions = false;
    if (!isFullSync) {
      const tombstones = await adminDb
        .collection(`users/${uid}/_tombstones`)
        .where("deletedAt", ">", Timestamp.fromMillis(since))
        .orderBy("deletedAt")
        .limit(PAGE_SIZE)
        .get();

      deletions = tombstones.docs.map((doc) => {
        const data = doc.data();
        const deletedAt = toMillis(data.deletedAt);
        if (deletedAt && deletedAt > maxSeen) maxSeen = deletedAt;
        return {
          collection: String(data.collection),
          docId: String(data.docId),
          deletedAt,
        };
      });
      moreDeletions = tombstones.size >= PAGE_SIZE;
    }

    const pagedCollections = Object.entries(nextAfter).filter(([, v]) => v !== "");
    const hasMore = isFullSync
      ? pagedCollections.length > 0
      : Object.keys(nextAfter).length > 0 || moreDeletions;

    // A full snapshot has no updatedAt floor to advance from, so anchor on now.
    // The cursor only moves once every page has landed.
    const cursor = isFullSync
      ? pagedCollections.length > 0
        ? 0
        : Date.now()
      : Math.max(maxSeen, since);

    logger.info({
      event: "sync.delta",
      uid,
      since,
      full: isFullSync,
      collections: Object.keys(changes).length,
      deletions: deletions.length,
      hasMore,
    });

    return NextResponse.json(
      {
        changes,
        deletions,
        cursor,
        nextAfter: Object.fromEntries(pagedCollections),
        hasMore,
        full: isFullSync,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error({ event: "sync.delta_failed", uid, since }, error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
