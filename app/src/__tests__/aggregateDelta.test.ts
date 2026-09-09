import { describe, it, expect } from "vitest";
import {
  aggregateDeltaFor,
  transitionDeltas,
  type AggregatableTxn,
} from "@/server/aggregates/delta";

const expense = (over: Partial<AggregatableTxn> = {}): AggregatableTxn => ({
  amount: -500,
  type: "expense",
  category: "Food",
  cycleKey: "2026-03",
  ...over,
});

const income = (over: Partial<AggregatableTxn> = {}): AggregatableTxn => ({
  amount: 50000,
  type: "income",
  category: "Income",
  cycleKey: "2026-03",
  ...over,
});

describe("aggregateDeltaFor", () => {
  it("adds expense magnitude to spend and category breakdown", () => {
    const d = aggregateDeltaFor(expense(), 1)!;
    expect(d.get("totalSpent")).toBe(500);
    expect(d.get("categoryBreakdown.Food")).toBe(500);
    expect(d.get("transactionCount")).toBe(1);
  });

  it("reverses exactly what it applied", () => {
    const applied = aggregateDeltaFor(expense(), 1)!;
    const reversed = aggregateDeltaFor(expense(), -1)!;
    for (const [field, value] of applied) {
      expect(reversed.get(field)).toBe(-value);
    }
  });

  it("routes income to totalIncome and the Income bucket", () => {
    const d = aggregateDeltaFor(income(), 1)!;
    expect(d.get("totalIncome")).toBe(50000);
    expect(d.get("categoryBreakdown.Income")).toBe(50000);
    expect(d.has("totalSpent")).toBe(false);
  });

  it("tracks investment spend separately without double counting spend", () => {
    const d = aggregateDeltaFor(
      expense({ category: "Investment" }),
      1,
      new Set(["Investment"])
    )!;
    expect(d.get("totalSpent")).toBe(500);
    expect(d.get("totalInvestmentSpend")).toBe(500);
  });

  it("skips self transfers", () => {
    expect(aggregateDeltaFor(expense({ payment_type: "Self Transfer" }), 1)).toBeNull();
  });

  it("skips credit card payments", () => {
    expect(aggregateDeltaFor(expense({ category: "Credit Card Payment" }), 1)).toBeNull();
  });

  it("uses magnitude regardless of stored sign", () => {
    const negative = aggregateDeltaFor(expense({ amount: -500 }), 1)!;
    const positive = aggregateDeltaFor(expense({ amount: 500 }), 1)!;
    expect(negative.get("totalSpent")).toBe(positive.get("totalSpent"));
  });
});

describe("transitionDeltas", () => {
  it("creates produce only positive deltas", () => {
    const d = transitionDeltas(null, expense());
    expect(d.get("2026-03")!.get("totalSpent")).toBe(500);
  });

  it("deletes produce only negative deltas", () => {
    const d = transitionDeltas(expense(), null);
    expect(d.get("2026-03")!.get("totalSpent")).toBe(-500);
    expect(d.get("2026-03")!.get("transactionCount")).toBe(-1);
  });

  it("is a no-op when nothing relevant changed", () => {
    const d = transitionDeltas(expense(), expense());
    expect(d.size).toBe(0);
  });

  it("moves category spend without changing the total", () => {
    const d = transitionDeltas(expense(), expense({ category: "Travel" }));
    const fields = d.get("2026-03")!;
    expect(fields.has("totalSpent")).toBe(false);
    expect(fields.has("transactionCount")).toBe(false);
    expect(fields.get("categoryBreakdown.Food")).toBe(-500);
    expect(fields.get("categoryBreakdown.Travel")).toBe(500);
  });

  it("handles an amount change in place", () => {
    const d = transitionDeltas(expense(), expense({ amount: -800 }));
    const fields = d.get("2026-03")!;
    expect(fields.get("totalSpent")).toBe(300);
    expect(fields.has("transactionCount")).toBe(false);
  });

  it("moves totals across cycles when the date moves", () => {
    const d = transitionDeltas(expense(), expense({ cycleKey: "2026-04" }));
    expect(d.get("2026-03")!.get("totalSpent")).toBe(-500);
    expect(d.get("2026-03")!.get("transactionCount")).toBe(-1);
    expect(d.get("2026-04")!.get("totalSpent")).toBe(500);
    expect(d.get("2026-04")!.get("transactionCount")).toBe(1);
  });

  it("handles an expense flipping to income", () => {
    const d = transitionDeltas(expense(), income());
    const fields = d.get("2026-03")!;
    expect(fields.get("totalSpent")).toBe(-500);
    expect(fields.get("categoryBreakdown.Food")).toBe(-500);
    expect(fields.get("totalIncome")).toBe(50000);
    expect(fields.has("transactionCount")).toBe(false);
  });

  it("removes spend when a transaction becomes a self transfer", () => {
    const d = transitionDeltas(expense(), expense({ payment_type: "Self Transfer" }));
    expect(d.get("2026-03")!.get("totalSpent")).toBe(-500);
    expect(d.get("2026-03")!.get("transactionCount")).toBe(-1);
  });

  it("adds spend when a self transfer becomes a real expense", () => {
    const d = transitionDeltas(expense({ payment_type: "Self Transfer" }), expense());
    expect(d.get("2026-03")!.get("totalSpent")).toBe(500);
  });

  it("drops investment spend when recategorised away", () => {
    const investments = new Set(["Investment"]);
    const d = transitionDeltas(
      expense({ category: "Investment" }),
      expense({ category: "Food" }),
      investments
    );
    expect(d.get("2026-03")!.get("totalInvestmentSpend")).toBe(-500);
    expect(d.get("2026-03")!.has("totalSpent")).toBe(false);
  });

  it("a create followed by its reversal nets to zero", () => {
    const created = transitionDeltas(null, expense());
    const deleted = transitionDeltas(expense(), null);
    for (const [field, value] of created.get("2026-03")!) {
      expect(deleted.get("2026-03")!.get(field)).toBe(-value);
    }
  });
});
