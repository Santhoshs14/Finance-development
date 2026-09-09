"use client";

import { authFetch } from "@/services/api";
import {
  getLocalDb,
  getMeta,
  setMeta,
  type LocalDb,
  type SyncedDoc,
} from "@/lib/localdb";
import { isSyncCollection, type SyncCollection } from "@/server/sync/collections";

const CURSOR_KEY = "syncCursor";
const MAX_PAGES = 20;

export interface SyncState {
  status: "idle" | "syncing" | "error";
  lastSyncedAt: number | null;
  error: string | null;
}

interface DeltaResponse {
  changes: Record<string, SyncedDoc[]>;
  deletions: { collection: string; docId: string }[];
  cursor: number;
  nextAfter: Record<string, string>;
  hasMore: boolean;
  full: boolean;
}

type Listener = (state: SyncState) => void;

class SyncEngine {
  private uid: string | null = null;
  private db: LocalDb | null = null;
  private listeners = new Set<Listener>();
  private inFlight: Promise<void> | null = null;
  private queued = false;

  private state: SyncState = { status: "idle", lastSyncedAt: null, error: null };

  attach(uid: string) {
    if (this.uid === uid) return;
    this.uid = uid;
    this.db = getLocalDb(uid);
    this.state = { status: "idle", lastSyncedAt: null, error: null };
    this.emit();
  }

  detach() {
    this.uid = null;
    this.db = null;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): SyncState {
    return this.state;
  }

  private emit() {
    for (const listener of this.listeners) listener(this.state);
  }

  private setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  /**
   * Pull deltas. Concurrent calls collapse: one runs, and at most one more is
   * queued, so a burst of mutations produces a single follow-up sync.
   */
  async pull(): Promise<void> {
    if (!this.uid || !this.db) return;

    if (this.inFlight) {
      this.queued = true;
      return this.inFlight;
    }

    this.inFlight = this.run().finally(() => {
      this.inFlight = null;
      if (this.queued) {
        this.queued = false;
        void this.pull();
      }
    });

    return this.inFlight;
  }

  private async run(): Promise<void> {
    const db = this.db;
    if (!db) return;

    this.setState({ status: "syncing", error: null });

    try {
      let after = "";

      for (let page = 0; page < MAX_PAGES; page++) {
        const since = (await getMeta<number>(db, CURSOR_KEY)) ?? 0;
        const params = new URLSearchParams({ since: String(since) });
        if (after) params.set("after", after);

        const res = await authFetch(`/api/sync?${params}`);
        const delta = (await res.json()) as DeltaResponse;

        await this.apply(db, delta);

        // A paged full sync keeps cursor at 0 until the last page lands, so an
        // interrupted first load resumes instead of silently going incremental.
        if (delta.cursor > 0) await setMeta(db, CURSOR_KEY, delta.cursor);

        if (!delta.hasMore) break;

        after = Object.entries(delta.nextAfter ?? {})
          .map(([collection, docId]) => `${collection}:${docId}`)
          .join(",");

        // Incremental pages advance via the cursor, not an `after` token.
        if (!delta.full) after = "";
      }

      this.setState({ status: "idle", lastSyncedAt: Date.now(), error: null });
    } catch (err) {
      this.setState({
        status: "error",
        error: err instanceof Error ? err.message : "Sync failed",
      });
    }
  }

  private async apply(db: LocalDb, delta: DeltaResponse): Promise<void> {
    const touched = Object.keys(delta.changes).filter(isSyncCollection);
    const deletionTargets = delta.deletions.filter((d) => isSyncCollection(d.collection));

    const tables = new Set<SyncCollection>([
      ...touched,
      ...deletionTargets.map((d) => d.collection as SyncCollection),
    ]);
    if (tables.size === 0) return;

    await db.transaction("rw", [...tables].map((t) => db[t]), async () => {
      for (const collection of touched) {
        const rows = delta.changes[collection];
        if (rows?.length) await db[collection].bulkPut(rows);
      }
      for (const deletion of deletionTargets) {
        await db[deletion.collection as SyncCollection].delete(deletion.docId);
      }
    });
  }

  /** Discard the cursor so the next pull re-fetches everything. */
  async reset(): Promise<void> {
    if (!this.db) return;
    await setMeta(this.db, CURSOR_KEY, 0);
  }
}

export const syncEngine = new SyncEngine();
