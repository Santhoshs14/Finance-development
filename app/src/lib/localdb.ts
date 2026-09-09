"use client";

import Dexie, { type EntityTable } from "dexie";
import { SYNC_COLLECTIONS, type SyncCollection } from "@/server/sync/collections";

export interface SyncedDoc {
  id: string;
  [key: string]: unknown;
}

export interface SyncMeta {
  key: string;
  value: unknown;
}

/** A mutation waiting to reach the server. */
export interface OutboxEntry {
  id: string;
  url: string;
  method: string;
  body?: string;
  collection: SyncCollection | null;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
  status: "pending" | "failed";
}

type CollectionTables = {
  [K in SyncCollection]: EntityTable<SyncedDoc, "id">;
};

export type LocalDb = Dexie &
  CollectionTables & {
    _meta: EntityTable<SyncMeta, "key">;
    _outbox: EntityTable<OutboxEntry, "id">;
  };

const DB_PREFIX = "wealthflow";

const instances = new Map<string, LocalDb>();

function buildSchema(): Record<string, string> {
  const schema: Record<string, string> = {
    _meta: "key",
    _outbox: "id, status, nextAttemptAt, createdAt",
  };
  for (const collection of SYNC_COLLECTIONS) {
    // `date` and `cycleKey` back the transaction views; the rest query by id.
    schema[collection] = "id, cycleKey, date, updatedAt";
  }
  return schema;
}

/** One database per user so switching accounts can never mix data. */
export function getLocalDb(uid: string): LocalDb {
  const existing = instances.get(uid);
  if (existing) return existing;

  const db = new Dexie(`${DB_PREFIX}:${uid}`) as LocalDb;
  db.version(1).stores(buildSchema());
  instances.set(uid, db);
  return db;
}

export async function destroyLocalDb(uid: string): Promise<void> {
  const db = instances.get(uid);
  if (db) {
    db.close();
    instances.delete(uid);
  }
  await Dexie.delete(`${DB_PREFIX}:${uid}`);
}

export async function getMeta<T>(db: LocalDb, key: string): Promise<T | undefined> {
  const row = await db._meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(db: LocalDb, key: string, value: unknown): Promise<void> {
  await db._meta.put({ key, value });
}
