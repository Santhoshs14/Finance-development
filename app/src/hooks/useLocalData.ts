"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getLocalDb, type SyncedDoc } from "@/lib/localdb";
import { syncEngine, type SyncState } from "@/lib/sync-engine";
import type { SyncCollection } from "@/server/sync/collections";

const EMPTY: never[] = [];

/**
 * Live view of a locally-replicated collection. Returns `undefined` while the
 * first read is in flight so callers can distinguish "loading" from "empty".
 */
export function useLocalCollection<T>(
  uid: string | null,
  name: SyncCollection,
  enabled = true
): T[] | undefined {
  return useLiveQuery(async () => {
    if (!uid || !enabled) return EMPTY as unknown as T[];
    const rows = await getLocalDb(uid)[name].toArray();
    return rows as unknown as T[];
  }, [uid, name, enabled]);
}

/** Single document from a locally-replicated collection. */
export function useLocalDoc<T>(
  uid: string | null,
  name: SyncCollection,
  id: string | null
): T | undefined {
  return useLiveQuery(async () => {
    if (!uid || !id) return undefined;
    return (await getLocalDb(uid)[name].get(id)) as T | undefined;
  }, [uid, name, id]);
}

export function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>(syncEngine.getState());
  useEffect(() => syncEngine.subscribe(setState), []);
  return state;
}

/** Number of mutations still waiting to reach the server. */
export function usePendingWrites(uid: string | null): number {
  const count = useLiveQuery(async () => {
    if (!uid) return 0;
    return getLocalDb(uid)._outbox.count();
  }, [uid]);
  return count ?? 0;
}

export function useSortedTransactions<T extends SyncedDoc & { date?: string }>(
  rows: T[] | undefined
): T[] {
  return useMemo(() => {
    if (!rows) return [];
    return [...rows].sort((a, b) => {
      const dateCmp = String(b.date ?? "").localeCompare(String(a.date ?? ""));
      if (dateCmp !== 0) return dateCmp;
      return Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0);
    });
  }, [rows]);
}
