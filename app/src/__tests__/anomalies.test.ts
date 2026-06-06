import { describe, it, expect } from "vitest";
import {
  buildCategoryBaseline,
  detectAnomalies,
} from "@/utils/anomalies";

describe("anomalies", () => {
  describe("buildCategoryBaseline", () => {
    it("returns empty array for empty history", () => {
      expect(buildCategoryBaseline([])).toEqual([]);
    });

    it("computes mean and stddev per category", () => {
      const base = buildCategoryBaseline([
        { cycleKey: "2026-01", categoryBreakdown: { Food: 1000, Rent: 30000 } },
        { cycleKey: "2026-02", categoryBreakdown: { Food: 1200, Rent: 30000 } },
        { cycleKey: "2026-03", categoryBreakdown: { Food: 1100, Rent: 30000 } },
      ]);
      const food = base.find((b) => b.category === "Food");
      const rent = base.find((b) => b.category === "Rent");
      expect(food).toBeTruthy();
      expect(food!.meanSpend).toBeCloseTo(1100, 0);
      expect(food!.stdDevSpend).toBeGreaterThan(0);
      expect(rent!.stdDevSpend).toBe(0); // constant
    });

    it("excludes Income from baseline", () => {
      const base = buildCategoryBaseline([
        { cycleKey: "2026-01", categoryBreakdown: { Income: 50000, Food: 1000 } },
      ]);
      expect(base.find((b) => b.category === "Income")).toBeUndefined();
    });
  });

  describe("detectAnomalies", () => {
    const baseline = [
      { category: "Food", meanSpend: 1000, stdDevSpend: 100 },
    ];

    it("flags category spike (z ≥ 2)", () => {
      const alerts = detectAnomalies({
        currentCycleBreakdown: { Food: 1300 }, // z=3
        baseline,
        currentCycleTxns: [],
        knownMerchants: new Set(),
      });
      expect(alerts.length).toBeGreaterThan(0);
      const spike = alerts.find((a) => a.type === "category_spike");
      expect(spike).toBeTruthy();
      expect(spike!.severity).toBe("high");
    });

    it("does not flag normal spending", () => {
      const alerts = detectAnomalies({
        currentCycleBreakdown: { Food: 1050 }, // z=0.5
        baseline,
        currentCycleTxns: [],
        knownMerchants: new Set(),
      });
      expect(alerts.filter((a) => a.type === "category_spike")).toHaveLength(0);
    });

    it("flags large transactions within category (z ≥ 2.5)", () => {
      // 9 small purchases + 1 huge outlier so z-score crosses 2.5
      const txns = [
        { id: "1", date: "2026-06-01", amount: -100, category: "Food" },
        { id: "2", date: "2026-06-02", amount: -110, category: "Food" },
        { id: "3", date: "2026-06-03", amount: -120, category: "Food" },
        { id: "4", date: "2026-06-04", amount: -90, category: "Food" },
        { id: "5", date: "2026-06-05", amount: -105, category: "Food" },
        { id: "6", date: "2026-06-06", amount: -115, category: "Food" },
        { id: "7", date: "2026-06-07", amount: -95, category: "Food" },
        { id: "8", date: "2026-06-08", amount: -125, category: "Food" },
        { id: "9", date: "2026-06-09", amount: -100, category: "Food" },
        { id: "10", date: "2026-06-10", amount: -8000, category: "Food" }, // huge outlier
      ];
      const alerts = detectAnomalies({
        currentCycleBreakdown: {},
        baseline: [],
        currentCycleTxns: txns,
        knownMerchants: new Set(),
      });
      const unusual = alerts.find((a) => a.type === "unusual_txn");
      expect(unusual).toBeTruthy();
      expect(unusual!.txnId).toBe("10");
    });

    it("flags new merchants", () => {
      const alerts = detectAnomalies({
        currentCycleBreakdown: {},
        baseline: [],
        currentCycleTxns: [
          { id: "1", date: "2026-06-01", amount: -500, category: "Food", notes: "BrandNewMerchant" },
        ],
        knownMerchants: new Set(), // empty
      });
      const newm = alerts.find((a) => a.type === "new_merchant");
      expect(newm).toBeTruthy();
    });

    it("does not flag known merchants as new", () => {
      const alerts = detectAnomalies({
        currentCycleBreakdown: {},
        baseline: [],
        currentCycleTxns: [
          { id: "1", date: "2026-06-01", amount: -500, category: "Food", notes: "Swiggy" },
        ],
        knownMerchants: new Set(["swiggy"]),
      });
      expect(alerts.filter((a) => a.type === "new_merchant")).toHaveLength(0);
    });

    it("sorts by severity then amount", () => {
      const txns = [
        { id: "1", date: "2026-06-01", amount: -100, category: "Food" },
        { id: "2", date: "2026-06-02", amount: -110, category: "Food" },
        { id: "3", date: "2026-06-03", amount: -120, category: "Food" },
        { id: "4", date: "2026-06-04", amount: -90, category: "Food" },
        { id: "5", date: "2026-06-05", amount: -105, category: "Food" },
        { id: "6", date: "2026-06-06", amount: -50000, category: "Food" },
      ];
      const alerts = detectAnomalies({
        currentCycleBreakdown: { Food: 100000 },
        baseline,
        currentCycleTxns: txns,
        knownMerchants: new Set(),
      });
      // First alert should be high severity
      expect(alerts[0]?.severity).toBe("high");
    });
  });
});
