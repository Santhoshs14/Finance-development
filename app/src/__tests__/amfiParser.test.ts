import { describe, it, expect } from "vitest";
import { parseAmfiNav } from "@/server/jobs/fetchNav";

describe("AMFI NAV parser", () => {
  it("returns empty array for empty input", () => {
    expect(parseAmfiNav("")).toEqual([]);
  });

  it("parses one fund-house block correctly", () => {
    const sample = `

Aditya Birla Sun Life Mutual Fund

 Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
119553;INF209KA1RA8;-;Aditya Birla SL Conservative Hybrid Fund-Regular Plan- Growth;58.4762;06-Jun-2026
119554;INF209KA1RB6;-;Aditya Birla SL Conservative Hybrid Fund-Regular Plan- Dividend;26.8312;06-Jun-2026

Axis Mutual Fund

 Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
120465;INF846K01CH7;-;Axis Bluechip Fund - Direct Plan - Growth;65.4321;06-Jun-2026
`;
    const out = parseAmfiNav(sample);
    expect(out).toHaveLength(3);
    expect(out[0]!.schemeCode).toBe("119553");
    expect(out[0]!.nav).toBeCloseTo(58.4762, 4);
    expect(out[0]!.date).toBe("2026-06-06");
    expect(out[0]!.fundHouse).toBe("Aditya Birla Sun Life");
    expect(out[2]!.fundHouse).toBe("Axis");
    expect(out[2]!.isin).toBe("INF846K01CH7");
  });

  it("normalizes date format DD-Mon-YYYY → YYYY-MM-DD", () => {
    const sample = `
Test Fund Mutual Fund

 Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
12345;INF123;-;Test Scheme;100.00;01-Jan-2026
`;
    const out = parseAmfiNav(sample);
    expect(out[0]!.date).toBe("2026-01-01");
  });

  it("skips malformed lines", () => {
    const sample = `
Mutual Fund

 Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
malformed;data;here
12345;INF;-;Valid;50.0;15-Mar-2026
;;
`;
    const out = parseAmfiNav(sample);
    expect(out).toHaveLength(1);
    expect(out[0]!.schemeCode).toBe("12345");
  });

  it("rejects negative or zero NAV", () => {
    const sample = `
Mutual Fund

 Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
1;INF1;-;A;0.00;01-Jan-2026
2;INF2;-;B;-1.50;01-Jan-2026
3;INF3;-;C;25.50;01-Jan-2026
`;
    const out = parseAmfiNav(sample);
    expect(out).toHaveLength(1);
    expect(out[0]!.schemeCode).toBe("3");
  });
});
