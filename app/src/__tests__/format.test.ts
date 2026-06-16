import { describe, it, expect, beforeEach } from "vitest";
import { fmt, fmtCompact, setCurrencyFormat, setCurrencyRate } from "@/utils/format";

describe("fmt", () => {
  beforeEach(() => {
    setCurrencyFormat("INR");
    setCurrencyRate(1);
  });

  it("formats integer amounts with Indian grouping", () => {
    expect(fmt(1234)).toBe("₹1,234");
    expect(fmt(100000)).toBe("₹1,00,000");
  });

  it("formats decimal amounts (max 2 dp, no trailing zeros)", () => {
    expect(fmt(1234.5)).toBe("₹1,234.5");
    expect(fmt(1234.56)).toBe("₹1,234.56");
    expect(fmt(1234.0)).toBe("₹1,234");
  });

  it("handles zero and negative", () => {
    expect(fmt(0)).toBe("₹0");
    expect(fmt(-500)).toBe("₹-500");
  });

  it("handles string input", () => {
    expect(fmt("2500")).toBe("₹2,500");
    expect(fmt("")).toBe("₹0");
  });
});

describe("fmtCompact", () => {
  beforeEach(() => {
    setCurrencyFormat("INR");
    setCurrencyRate(1);
  });

  it("formats lakhs for INR", () => {
    expect(fmtCompact(100000)).toBe("₹1L");
    expect(fmtCompact(250000)).toBe("₹2.5L");
  });

  it("formats thousands for INR", () => {
    expect(fmtCompact(1500)).toBe("₹1.5k");
    expect(fmtCompact(5000)).toBe("₹5k");
  });

  it("formats small values without suffix", () => {
    expect(fmtCompact(500)).toBe("₹500");
    expect(fmtCompact(99)).toBe("₹99");
  });
});

describe("setCurrencyFormat", () => {
  it("switches to USD", () => {
    setCurrencyFormat("USD");
    expect(fmt(1000)).toBe("$1,000");
    expect(fmtCompact(1500000)).toBe("$1.5M");
  });

  it("switches to GBP", () => {
    setCurrencyFormat("GBP");
    expect(fmt(1000)).toBe("£1,000");
    expect(fmtCompact(1500000)).toBe("£1.5M");
  });

  it("switches to AED", () => {
    setCurrencyFormat("AED");
    expect(fmt(1000)).toBe("AED 1,000");
    expect(fmtCompact(1500000)).toBe("AED 1.5M");
  });

  it("ignores unknown currencies", () => {
    setCurrencyFormat("INR");
    setCurrencyFormat("XYZ");
    expect(fmt(100)).toBe("₹100");
  });
});

describe("setCurrencyRate", () => {
  beforeEach(() => {
    setCurrencyFormat("INR");
    setCurrencyRate(1);
  });

  it("converts INR-stored amounts to the display currency", () => {
    setCurrencyFormat("USD");
    setCurrencyRate(0.012); // 1 INR = 0.012 USD
    expect(fmt(1000)).toBe("$12");
  });

  it("ignores non-positive or non-finite rates (no conversion)", () => {
    setCurrencyRate(0);
    expect(fmt(1000)).toBe("₹1,000");
    setCurrencyRate(Number.NaN);
    expect(fmt(1000)).toBe("₹1,000");
  });
});
