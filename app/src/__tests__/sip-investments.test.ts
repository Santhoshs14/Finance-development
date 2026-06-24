import { describe, it, expect } from "vitest";
import {
  projectMaturityValue,
  projectRecurringDepositValue,
  daysToMaturity,
  calculatePortfolioAllocation,
  type Investment,
} from "@/utils/calculations";

describe("projectMaturityValue", () => {
  it("computes simple interest", () => {
    // 100000 @ 10% for 2y simple = 100000 * (1 + 0.1*2) = 120000
    expect(projectMaturityValue(100000, 10, 2, "simple")).toBe(120000);
  });

  it("computes quarterly compounding", () => {
    // 100000 @ 8% for 1y, quarterly: 100000 * (1 + 0.02)^4 ≈ 108243.22
    expect(projectMaturityValue(100000, 8, 1, "quarterly")).toBeCloseTo(108243.22, 1);
  });

  it("compounds annually higher than nothing and ≥ principal", () => {
    const v = projectMaturityValue(50000, 7, 3, "annually");
    expect(v).toBeGreaterThan(50000);
  });

  it("returns principal for invalid inputs", () => {
    expect(projectMaturityValue(10000, 0, 5)).toBe(10000);
    expect(projectMaturityValue(10000, 7, 0)).toBe(10000);
  });
});

describe("projectRecurringDepositValue", () => {
  it("accrues monthly deposits with interest above the plain sum", () => {
    const months = 12;
    const monthly = 5000;
    const value = projectRecurringDepositValue(monthly, 7, months);
    expect(value).toBeGreaterThan(monthly * months); // interest earned
  });

  it("returns 0 for invalid inputs", () => {
    expect(projectRecurringDepositValue(0, 7, 12)).toBe(0);
    expect(projectRecurringDepositValue(5000, 7, 0)).toBe(0);
  });
});

describe("daysToMaturity", () => {
  it("returns null when no date", () => {
    expect(daysToMaturity(undefined)).toBeNull();
  });

  it("is positive for a future date", () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    expect(daysToMaturity(future)).toBeGreaterThan(0);
  });

  it("is negative for a past date", () => {
    const past = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    expect(daysToMaturity(past)!).toBeLessThan(0);
  });
});

describe("calculatePortfolioAllocation — new asset types", () => {
  const inv = (investment_type: string, value: number): Investment => ({
    id: investment_type,
    name: investment_type,
    investment_type,
    buy_price: value,
    current_price: value,
    quantity: 1,
  });

  it("buckets fixed-income types into Debt", () => {
    const result = calculatePortfolioAllocation(
      [],
      [inv("FD", 1000), inv("RD", 1000), inv("PPF", 1000), inv("NPS", 1000), inv("EPF", 1000)]
    );
    expect(result.totals.Debt).toBe(5000);
    expect(result.totals.Equity).toBe(0);
  });

  it("buckets Real Estate and Crypto into their own classes", () => {
    const result = calculatePortfolioAllocation(
      [],
      [inv("Real Estate", 3000), inv("Crypto", 2000)]
    );
    expect(result.totals["Real Estate"]).toBe(3000);
    expect(result.totals.Crypto).toBe(2000);
  });
});
