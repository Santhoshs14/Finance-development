/**
 * Canonical list of per-user subcollections that are exported and restored as
 * a unit (see `/api/export` and `/api/import/restore`). Keeping it in one place
 * means the export → restore round-trip can never drift.
 */
export const USER_DATA_COLLECTIONS = [
  "transactions",
  "accounts",
  "categories",
  "budgetSnapshots",
  "creditCards",
  "emis",
  "goals",
  "investments",
  "lending",
  "recurring",
  "splits",
  "aggregates",
] as const;

export type UserDataCollection = (typeof USER_DATA_COLLECTIONS)[number];
