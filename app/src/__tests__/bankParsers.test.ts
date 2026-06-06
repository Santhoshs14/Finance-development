import { describe, it, expect } from "vitest";
import { hdfcParser } from "@/server/parsers/hdfc";
import { sbiParser } from "@/server/parsers/sbi";
import { iciciParser } from "@/server/parsers/icici";
import { axisParser } from "@/server/parsers/axis";
import { kotakParser } from "@/server/parsers/kotak";
import { genericParser } from "@/server/parsers/generic";
import { detectAndParse } from "@/server/parsers";

describe("Bank statement parsers", () => {
  describe("HDFC", () => {
    it("detects HDFC header", () => {
      expect(hdfcParser.detect("HDFC BANK STATEMENT")).toBe(true);
      expect(hdfcParser.detect("SBI Statement")).toBe(false);
    });
    it("parses Dr/Cr rows", () => {
      const text = `HDFC BANK
01/06/2026 UPI Payment Swiggy 500.00 Dr
05/06/2026 SALARY CR 50000.00 Cr`;
      const txns = hdfcParser.parse(text);
      expect(txns).toHaveLength(2);
      expect(txns[0]!.amount).toBe(-500);
      expect(txns[0]!.type).toBe("expense");
      expect(txns[1]!.amount).toBe(50000);
      expect(txns[1]!.type).toBe("income");
      expect(txns[0]!.date).toBe("2026-06-01");
    });
  });

  describe("SBI", () => {
    it("detects SBI header", () => {
      expect(sbiParser.detect("STATE BANK OF INDIA")).toBe(true);
      expect(sbiParser.detect("HDFC BANK")).toBe(false);
    });
    it("parses 'DD Mon YYYY' format", () => {
      const text = `STATE BANK OF INDIA
01 Jun 2026 ATM WITHDRAWAL -500.00
05 Jun 2026 SALARY 50000.00`;
      const txns = sbiParser.parse(text);
      expect(txns.length).toBeGreaterThanOrEqual(2);
      expect(txns[0]!.date).toBe("2026-06-01");
    });
  });

  describe("ICICI", () => {
    it("detects ICICI header", () => {
      expect(iciciParser.detect("ICICI BANK")).toBe(true);
    });
    it("parses Dr/Cr format with hyphens", () => {
      const text = `ICICI BANK
01-06-2026 UPI Transfer 500.00 Dr
02-06-2026 NEFT Credit 1000.00 Cr`;
      const txns = iciciParser.parse(text);
      expect(txns).toHaveLength(2);
      expect(txns[0]!.amount).toBe(-500);
      expect(txns[1]!.amount).toBe(1000);
    });
  });

  describe("Axis", () => {
    it("detects Axis header", () => {
      expect(axisParser.detect("AXIS BANK")).toBe(true);
    });
    it("parses DD/MM/YY format", () => {
      const text = `AXIS BANK
01/06/26 PAYMENT 500.00 DR
02/06/26 CREDIT 1000.00 CR`;
      const txns = axisParser.parse(text);
      expect(txns).toHaveLength(2);
      expect(txns[0]!.date).toBe("2026-06-01");
      expect(txns[0]!.amount).toBe(-500);
    });
  });

  describe("Kotak", () => {
    it("detects Kotak header", () => {
      expect(kotakParser.detect("KOTAK MAHINDRA BANK")).toBe(true);
    });
    it("parses DD-MMM-YYYY format", () => {
      const text = `KOTAK MAHINDRA BANK
01-Jun-2026 ATM WITHDRAWAL 500.00 D
02-Jun-2026 NEFT 1000.00 C`;
      const txns = kotakParser.parse(text);
      expect(txns).toHaveLength(2);
      expect(txns[0]!.date).toBe("2026-06-01");
      expect(txns[1]!.amount).toBe(1000);
    });
  });

  describe("Generic fallback", () => {
    it("catches common date|desc|amount layout", () => {
      const text = `Random Bank
01/06/2026 SOMETHING -500.00
02/06/2026 ELSE 1000.00`;
      const txns = genericParser.parse(text);
      expect(txns.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("detectAndParse", () => {
    it("auto-selects HDFC parser", () => {
      const result = detectAndParse(`HDFC BANK STATEMENT
01/06/2026 PAYMENT 500.00 Dr`);
      expect(result.bank).toBe("HDFC Bank");
      expect(result.matched).toBe(true);
    });

    it("falls back to generic for unknown banks", () => {
      const result = detectAndParse(`Unknown Bank Statement
01/06/2026 ENTRY 500.00`);
      expect(result.bank).toBe("Generic");
    });
  });
});
