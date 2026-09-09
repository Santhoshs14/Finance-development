import { describe, it, expect } from "vitest";
import {
  SYNC_COLLECTIONS,
  isSyncCollection,
} from "@/server/sync/collections";

describe("sync collections", () => {
  it("covers every collection DataProvider exposes", () => {
    // Guards against a collection being added to the UI but never replicated,
    // which would silently render stale or empty data.
    const required = [
      "accounts",
      "transactions",
      "categories",
      "recurring",
      "notifications",
      "aggregates",
      "investments",
      "goals",
      "sips",
    ];
    for (const name of required) {
      expect(SYNC_COLLECTIONS).toContain(name);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(SYNC_COLLECTIONS).size).toBe(SYNC_COLLECTIONS.length);
  });

  it("excludes budgetSnapshots, which is nested and needs a group query", () => {
    expect(SYNC_COLLECTIONS).not.toContain("budgetSnapshots");
  });

  it("rejects paths that are not replicated", () => {
    expect(isSyncCollection("_idempotency")).toBe(false);
    expect(isSyncCollection("_tombstones")).toBe(false);
    expect(isSyncCollection("passkeys")).toBe(false);
    expect(isSyncCollection("audit")).toBe(false);
  });

  it("accepts replicated collections", () => {
    expect(isSyncCollection("transactions")).toBe(true);
    expect(isSyncCollection("accounts")).toBe(true);
  });
});
