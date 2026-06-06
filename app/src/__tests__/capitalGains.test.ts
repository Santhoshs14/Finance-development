import { describe, it, expect } from "vitest";
import {
  applyFifoRedemption,
  rollupFy,
  type Lot,
} from "@/utils/capitalGains";

describe("capitalGains FIFO", () => {
  describe("applyFifoRedemption", () => {
    it("consumes the oldest lot first", () => {
      const lots: Lot[] = [
        { date: "2024-01-15", units: 100, pricePerUnit: 50 },
        { date: "2024-06-01", units: 100, pricePerUnit: 80 },
      ];
      const rows = applyFifoRedemption(
        "ABC Fund",
        "equity_mf",
        lots,
        { date: "2025-08-01", units: 80, pricePerUnit: 100 }
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]!.units).toBe(80);
      expect(rows[0]!.cost).toBe(4000);
      expect(rows[0]!.proceeds).toBe(8000);
      expect(rows[0]!.gain).toBe(4000);
      expect(rows[0]!.classification).toBe("LTCG"); // > 1 year
    });

    it("splits redemption across multiple lots", () => {
      const lots: Lot[] = [
        { date: "2024-01-15", units: 50, pricePerUnit: 50 },
        { date: "2024-06-01", units: 100, pricePerUnit: 80 },
      ];
      const rows = applyFifoRedemption(
        "ABC Fund",
        "equity_mf",
        lots,
        { date: "2025-08-01", units: 100, pricePerUnit: 100 }
      );
      expect(rows).toHaveLength(2);
      expect(rows[0]!.units).toBe(50);
      expect(rows[1]!.units).toBe(50);
      expect(rows[0]!.gain).toBe(50 * (100 - 50));
      expect(rows[1]!.gain).toBe(50 * (100 - 80));
    });

    it("classifies <12mo as STCG for equity", () => {
      const lots: Lot[] = [{ date: "2025-03-01", units: 100, pricePerUnit: 50 }];
      const rows = applyFifoRedemption(
        "X Fund",
        "equity_mf",
        lots,
        { date: "2025-08-01", units: 100, pricePerUnit: 70 }
      );
      expect(rows[0]!.classification).toBe("STCG");
    });

    it("classifies >24mo as LTCG for debt", () => {
      const lots: Lot[] = [{ date: "2023-01-01", units: 100, pricePerUnit: 100 }];
      const rows = applyFifoRedemption(
        "Y Debt",
        "debt_mf",
        lots,
        { date: "2026-01-01", units: 100, pricePerUnit: 130 }
      );
      expect(rows[0]!.classification).toBe("LTCG");
    });
  });

  describe("rollupFy", () => {
    it("applies LTCG equity exemption of 1.25L", () => {
      const rows = applyFifoRedemption(
        "Big Win",
        "equity_mf",
        [{ date: "2023-01-01", units: 1000, pricePerUnit: 100 }],
        { date: "2026-01-01", units: 1000, pricePerUnit: 200 }
      );
      // Gain = 100,000 (below 125k exemption)
      const summary = rollupFy(rows);
      expect(summary.ltcgEquity).toBe(100000);
      expect(summary.estimatedTax.ltcgEquity).toBe(0);
    });

    it("taxes LTCG equity above exemption at 12.5%", () => {
      const rows = applyFifoRedemption(
        "Bigger Win",
        "equity_mf",
        [{ date: "2023-01-01", units: 1000, pricePerUnit: 100 }],
        { date: "2026-01-01", units: 1000, pricePerUnit: 325 }
      );
      const summary = rollupFy(rows);
      // Gain = 225,000, exemption removes first 125k → taxable 100k at 12.5% = 12,500
      expect(summary.estimatedTax.ltcgEquity).toBe(12500);
    });

    it("taxes STCG equity at 20%", () => {
      const rows = applyFifoRedemption(
        "Quick Win",
        "equity_mf",
        [{ date: "2025-12-01", units: 100, pricePerUnit: 50 }],
        { date: "2026-03-01", units: 100, pricePerUnit: 100 }
      );
      const summary = rollupFy(rows);
      // Gain = 5,000 at 20% = 1,000
      expect(summary.estimatedTax.stcgEquity).toBe(1000);
    });

    it("returns zero tax for STCG debt (slab-rate)", () => {
      const rows = applyFifoRedemption(
        "Debt",
        "debt_mf",
        [{ date: "2025-06-01", units: 100, pricePerUnit: 100 }],
        { date: "2025-12-01", units: 100, pricePerUnit: 110 }
      );
      const summary = rollupFy(rows);
      expect(summary.estimatedTax.stcgDebtGold).toBe(0);
      expect(summary.stcgDebtGold).toBe(1000);
    });

    it("totals across all buckets", () => {
      const rowsA = applyFifoRedemption(
        "A",
        "equity_mf",
        [{ date: "2023-01-01", units: 100, pricePerUnit: 100 }],
        { date: "2026-01-01", units: 100, pricePerUnit: 300 } // LTCG 20,000 — under exemption
      );
      const rowsB = applyFifoRedemption(
        "B",
        "equity_mf",
        [{ date: "2025-12-01", units: 100, pricePerUnit: 50 }],
        { date: "2026-02-01", units: 100, pricePerUnit: 100 } // STCG 5,000
      );
      const summary = rollupFy([...rowsA, ...rowsB]);
      // LTCG = 20,000 (under 125k exemption → 0 tax)
      // STCG = 5,000 at 20% = 1,000
      expect(summary.estimatedTax.total).toBe(1000);
    });
  });
});
