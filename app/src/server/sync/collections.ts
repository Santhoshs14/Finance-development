/**
 * Per-user collections replicated to the client's local store.
 *
 * `budgetSnapshots` is deliberately absent: it is nested as
 * `budgetSnapshots/{cycleKey}/categories/{id}` and needs a collection-group
 * query rather than the flat scan the delta feed performs.
 */
export const SYNC_COLLECTIONS = [
  "accounts",
  "transactions",
  "categories",
  "recurring",
  "notifications",
  "aggregates",
  "investments",
  "goals",
  "sips",
  "emis",
  "lending",
  "splits",
] as const;

export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];

export function isSyncCollection(value: string): value is SyncCollection {
  return (SYNC_COLLECTIONS as readonly string[]).includes(value);
}
