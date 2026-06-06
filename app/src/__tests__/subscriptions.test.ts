import { describe, it, expect } from "vitest";
import { detectSubscriptions } from "@/utils/subscriptions";

function makeTxn(date: string, amount: number, notes: string, category = "Subscription") {
  return { date, amount, notes, category };
}

describe("subscriptions.detectSubscriptions", () => {
  it("returns empty array for too few transactions", () => {
    expect(detectSubscriptions([])).toEqual([]);
    expect(detectSubscriptions([makeTxn("2026-01-01", -100, "X")])).toEqual([]);
  });

  it("ignores income transactions", () => {
    const out = detectSubscriptions([
      makeTxn("2026-01-01", 5000, "Salary"),
      makeTxn("2026-02-01", 5000, "Salary"),
      makeTxn("2026-03-01", 5000, "Salary"),
    ]);
    expect(out).toEqual([]);
  });

  it("detects monthly Netflix-like pattern", () => {
    const out = detectSubscriptions([
      makeTxn("2026-01-05", -499, "Netflix subscription"),
      makeTxn("2026-02-05", -499, "Netflix subscription"),
      makeTxn("2026-03-05", -499, "Netflix subscription"),
      makeTxn("2026-04-05", -499, "Netflix subscription"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.frequency).toBe("monthly");
    expect(out[0]!.meanAmount).toBeCloseTo(499, 0);
    expect(out[0]!.merchant.toLowerCase()).toContain("netflix");
  });

  it("rejects volatile amounts", () => {
    const out = detectSubscriptions([
      makeTxn("2026-01-05", -100, "Foo"),
      makeTxn("2026-02-05", -500, "Foo"),
      makeTxn("2026-03-05", -1000, "Foo"),
    ]);
    expect(out).toEqual([]);
  });

  it("detects weekly cadence", () => {
    const out = detectSubscriptions([
      makeTxn("2026-01-01", -200, "Gym pass"),
      makeTxn("2026-01-08", -200, "Gym pass"),
      makeTxn("2026-01-15", -200, "Gym pass"),
      makeTxn("2026-01-22", -200, "Gym pass"),
    ]);
    expect(out[0]?.frequency).toBe("weekly");
  });

  it("sorts by confidence descending", () => {
    const out = detectSubscriptions([
      // High-conf monthly
      makeTxn("2026-01-05", -500, "Netflix"),
      makeTxn("2026-02-05", -500, "Netflix"),
      makeTxn("2026-03-05", -500, "Netflix"),
      makeTxn("2026-04-05", -500, "Netflix"),
      // Lower-conf (only 3 occurrences)
      makeTxn("2026-01-10", -300, "Spotify"),
      makeTxn("2026-02-10", -300, "Spotify"),
      makeTxn("2026-03-10", -300, "Spotify"),
    ]);
    expect(out.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1]!.confidence).toBeGreaterThanOrEqual(out[i]!.confidence);
    }
  });

  it("computes next-expected date based on cadence", () => {
    const out = detectSubscriptions([
      makeTxn("2026-01-05", -200, "Hotstar"),
      makeTxn("2026-02-05", -200, "Hotstar"),
      makeTxn("2026-03-05", -200, "Hotstar"),
      makeTxn("2026-04-05", -200, "Hotstar"),
    ]);
    expect(out[0]?.nextExpected).toBeDefined();
    // Last txn is Apr 5 + ~30 days = May 5 area; allow either ISO format.
    expect(out[0]!.nextExpected).toMatch(/^2026-05-/);
  });
});
