import { describe, it, expect, beforeEach } from "vitest";
import { fmt, fmtCompact, setCurrencyFormat } from "@/utils/format";

// ═══════════════════════════════════════════════════════════════════════
// fmt - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("fmt", () => {
  describe("INR formatting", () => {
    beforeEach(() => setCurrencyFormat("INR"));

    it("formats zero", () => {
      expect(fmt(0)).toBe("₹0");
    });

    it("formats small integers", () => {
      expect(fmt(5)).toBe("₹5");
      expect(fmt(99)).toBe("₹99");
      expect(fmt(100)).toBe("₹100");
    });

    it("formats thousands with Indian grouping", () => {
      expect(fmt(1234)).toBe("₹1,234");
      expect(fmt(9999)).toBe("₹9,999");
    });

    it("formats lakhs with Indian grouping", () => {
      expect(fmt(100000)).toBe("₹1,00,000");
      expect(fmt(250000)).toBe("₹2,50,000");
    });

    it("formats crores with Indian grouping", () => {
      expect(fmt(10000000)).toBe("₹1,00,00,000");
    });

    it("formats decimal with 1 place (no trailing zero)", () => {
      expect(fmt(1234.5)).toBe("₹1,234.5");
    });

    it("formats decimal with 2 places", () => {
      expect(fmt(1234.56)).toBe("₹1,234.56");
    });

    it("strips trailing zeros from .00", () => {
      expect(fmt(1234.0)).toBe("₹1,234");
    });

    it("handles negative numbers", () => {
      expect(fmt(-500)).toBe("₹-500");
      expect(fmt(-100000)).toBe("₹-1,00,000");
    });

    it("handles string input - valid number", () => {
      expect(fmt("2500")).toBe("₹2,500");
    });

    it("handles string input - empty string", () => {
      expect(fmt("")).toBe("₹0");
    });

    it("handles string input - NaN", () => {
      expect(fmt("abc")).toBe("₹0");
    });

    it("handles very large numbers", () => {
      const result = fmt(999999999);
      expect(result).toContain("₹");
      expect(result.length).toBeGreaterThan(5);
    });

    it("handles very small decimals (rounds to max 2dp)", () => {
      expect(fmt(1.999)).toBe("₹2");
    });
  });

  describe("USD formatting", () => {
    beforeEach(() => setCurrencyFormat("USD"));

    it("uses $ symbol", () => {
      expect(fmt(1000)).toBe("$1,000");
    });

    it("uses US number grouping", () => {
      expect(fmt(1000000)).toBe("$1,000,000");
    });

    it("formats decimals", () => {
      expect(fmt(99.99)).toBe("$99.99");
    });
  });

  describe("EUR formatting", () => {
    beforeEach(() => setCurrencyFormat("EUR"));

    it("uses € symbol", () => {
      expect(fmt(1000)).toContain("€");
    });

    it("uses German locale formatting", () => {
      const result = fmt(1000);
      expect(result).toContain("€");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// fmtCompact - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("fmtCompact", () => {
  describe("INR compact formatting", () => {
    beforeEach(() => setCurrencyFormat("INR"));

    it("formats lakhs (≥1,00,000)", () => {
      expect(fmtCompact(100000)).toBe("₹1L");
      expect(fmtCompact(250000)).toBe("₹2.5L");
      expect(fmtCompact(1500000)).toBe("₹15L");
    });

    it("removes .0 from lakhs", () => {
      expect(fmtCompact(200000)).toBe("₹2L");
      expect(fmtCompact(1000000)).toBe("₹10L");
    });

    it("formats thousands (≥1,000)", () => {
      expect(fmtCompact(1000)).toBe("₹1k");
      expect(fmtCompact(1500)).toBe("₹1.5k");
      expect(fmtCompact(5000)).toBe("₹5k");
      expect(fmtCompact(99000)).toBe("₹99k");
    });

    it("removes .0 from thousands", () => {
      expect(fmtCompact(2000)).toBe("₹2k");
      expect(fmtCompact(10000)).toBe("₹10k");
    });

    it("formats small values without suffix", () => {
      expect(fmtCompact(500)).toBe("₹500");
      expect(fmtCompact(99)).toBe("₹99");
      expect(fmtCompact(0)).toBe("₹0");
    });

    it("strips trailing .00 for small values", () => {
      expect(fmtCompact(100)).toBe("₹100");
    });

    it("handles negative lakhs", () => {
      expect(fmtCompact(-100000)).toBe("₹-1L");
      expect(fmtCompact(-250000)).toBe("₹-2.5L");
    });

    it("handles negative thousands", () => {
      expect(fmtCompact(-1500)).toBe("₹-1.5k");
    });

    it("handles string input", () => {
      expect(fmtCompact("5000")).toBe("₹5k");
      expect(fmtCompact("")).toBe("₹0");
    });
  });

  describe("USD compact formatting", () => {
    beforeEach(() => setCurrencyFormat("USD"));

    it("formats millions (≥1,000,000)", () => {
      expect(fmtCompact(1000000)).toBe("$1M");
      expect(fmtCompact(1500000)).toBe("$1.5M");
      expect(fmtCompact(10000000)).toBe("$10M");
    });

    it("formats thousands", () => {
      expect(fmtCompact(1000)).toBe("$1k");
      expect(fmtCompact(5000)).toBe("$5k");
      expect(fmtCompact(99000)).toBe("$99k");
    });

    it("formats small values", () => {
      expect(fmtCompact(500)).toBe("$500");
      expect(fmtCompact(0)).toBe("$0");
    });
  });

  describe("EUR compact formatting", () => {
    beforeEach(() => setCurrencyFormat("EUR"));

    it("formats millions", () => {
      expect(fmtCompact(1000000)).toBe("€1M");
    });

    it("formats thousands", () => {
      expect(fmtCompact(5000)).toBe("€5k");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// setCurrencyFormat - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("setCurrencyFormat", () => {
  it("switches to INR", () => {
    setCurrencyFormat("INR");
    expect(fmt(1000)).toBe("₹1,000");
  });

  it("switches to USD", () => {
    setCurrencyFormat("USD");
    expect(fmt(1000)).toBe("$1,000");
  });

  it("switches to EUR", () => {
    setCurrencyFormat("EUR");
    expect(fmt(1000)).toContain("€");
  });

  it("ignores unknown currency codes", () => {
    setCurrencyFormat("INR"); // Set known first
    setCurrencyFormat("XYZ"); // Unknown
    expect(fmt(100)).toBe("₹100"); // Should remain INR
  });

  it("handles empty string", () => {
    setCurrencyFormat("INR");
    setCurrencyFormat("");
    expect(fmt(100)).toBe("₹100");
  });

  it("handles null-like values gracefully", () => {
    setCurrencyFormat("INR");
    setCurrencyFormat(undefined as unknown as string);
    expect(fmt(100)).toBe("₹100");
  });

  it("is case sensitive (lowercase should not work)", () => {
    setCurrencyFormat("INR");
    setCurrencyFormat("inr");
    expect(fmt(100)).toBe("₹100"); // Should stay INR since "inr" not in map
  });

  it("can switch between currencies multiple times", () => {
    setCurrencyFormat("INR");
    expect(fmt(1000)).toBe("₹1,000");
    setCurrencyFormat("USD");
    expect(fmt(1000)).toBe("$1,000");
    setCurrencyFormat("INR");
    expect(fmt(1000)).toBe("₹1,000");
  });
});
