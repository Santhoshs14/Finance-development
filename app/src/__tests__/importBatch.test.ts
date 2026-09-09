import { describe, it, expect } from "vitest";
import {
  prepareImportRows,
  computeImportDeltas,
} from "@/server/import/prepareRows";

const opts = { ownedAccountIds: new Set<string>(["acc-1"]), cycleStartDay: 25 };

const row = (over: Record<string, unknown> = {}) => ({
  date: "2026-03-10",
  amount: -450,
  description: "SWIGGY BANGALORE",
  type: "expense",
  ...over,
});

describe("prepareImportRows", () => {
  it("preserves the parsed description instead of dropping it", () => {
    const { rows } = prepareImportRows([row()], opts);
    expect(rows).toHaveLength(1);
    expect(rows[0].data.description).toBe("SWIGGY BANGALORE");
  });

  it("stamps a cycleKey so imported rows appear in cycle-filtered views", () => {
    const { rows } = prepareImportRows([row()], opts);
    // 10th is before the 25th cycle start, so it belongs to the March cycle.
    expect(rows[0].data.cycleKey).toBe("2026-03");
    expect(rows[0].cycleKey).toBe("2026-03");
  });

  it("rolls a date on/after the cycle start into the next cycle", () => {
    const { rows } = prepareImportRows([row({ date: "2026-03-25" })], opts);
    expect(rows[0].cycleKey).toBe("2026-04");
  });

  it("stores a signed amount and derives type when absent", () => {
    const { rows } = prepareImportRows(
      [row({ type: undefined, amount: 1200 })],
      opts
    );
    expect(rows[0].type).toBe("income");
    expect(rows[0].data.amount).toBe(1200);
    expect(rows[0].data.category).toBe("Income");
  });

  it("normalises expense magnitude to a negative stored amount", () => {
    const { rows } = prepareImportRows([row({ amount: 450, type: "expense" })], opts);
    expect(rows[0].data.amount).toBe(-450);
    expect(rows[0].magnitude).toBe(450);
  });

  it("produces a stable hash so re-importing the same row is a no-op", () => {
    const a = prepareImportRows([row()], opts).rows[0].importHash;
    const b = prepareImportRows([row()], opts).rows[0].importHash;
    expect(a).toBe(b);
  });

  it("dedupes identical rows within a single batch", () => {
    const { rows, skipped } = prepareImportRows([row(), row()], opts);
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it("treats differing descriptions as distinct rows", () => {
    const { rows } = prepareImportRows(
      [row(), row({ description: "ZOMATO" })],
      opts
    );
    expect(rows).toHaveLength(2);
  });

  it("unlinks accounts the caller does not own", () => {
    const { rows } = prepareImportRows([row({ account_id: "someone-else" })], opts);
    expect(rows[0].accountId).toBeNull();
    expect(rows[0].data.account_id).toBe("");
  });

  it("keeps accounts the caller does own", () => {
    const { rows } = prepareImportRows([row({ account_id: "acc-1" })], opts);
    expect(rows[0].accountId).toBe("acc-1");
  });

  it("skips rows that fail validation", () => {
    const { rows, skipped } = prepareImportRows(
      [row(), { date: "", amount: "nope" }],
      opts
    );
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(1);
  });
});

describe("computeImportDeltas", () => {
  it("accumulates spend and category breakdown per cycle", () => {
    const { rows } = prepareImportRows(
      [
        row({ amount: -100, description: "A" }),
        row({ amount: -250, description: "B" }),
      ],
      opts
    );
    const { aggregates } = computeImportDeltas(rows);
    const march = aggregates.get("2026-03")!;

    expect(march.get("totalSpent")).toBe(350);
    expect(march.get("categoryBreakdown.Other")).toBe(350);
    expect(march.get("transactionCount")).toBe(2);
  });

  it("separates income from expense totals", () => {
    const { rows } = prepareImportRows(
      [row({ amount: -100, description: "A" }), row({ amount: 5000, type: "income", description: "SALARY" })],
      opts
    );
    const march = computeImportDeltas(rows).aggregates.get("2026-03")!;

    expect(march.get("totalSpent")).toBe(100);
    expect(march.get("totalIncome")).toBe(5000);
  });

  it("splits deltas across cycles", () => {
    const { rows } = prepareImportRows(
      [
        row({ date: "2026-03-10", amount: -100 }),
        row({ date: "2026-03-26", amount: -200 }),
      ],
      opts
    );
    const { aggregates } = computeImportDeltas(rows);

    expect(aggregates.get("2026-03")!.get("totalSpent")).toBe(100);
    expect(aggregates.get("2026-04")!.get("totalSpent")).toBe(200);
  });

  it("nets account balance movement for linked accounts only", () => {
    const { rows } = prepareImportRows(
      [
        row({ amount: -100, account_id: "acc-1", description: "A" }),
        row({ amount: 300, type: "income", account_id: "acc-1", description: "B" }),
        row({ amount: -999, account_id: "not-mine", description: "C" }),
      ],
      opts
    );
    const { accounts } = computeImportDeltas(rows);

    expect(accounts.get("acc-1")).toBe(200);
    expect(accounts.has("not-mine")).toBe(false);
  });
});
