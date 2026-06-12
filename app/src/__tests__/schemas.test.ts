import { describe, it, expect } from "vitest";
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionListQuerySchema,
} from "@/schemas/transaction";
import { createAccountSchema } from "@/schemas/account";
import { createCategorySchema } from "@/schemas/category";
import { createBudgetSchema } from "@/schemas/budget";
import { createGoalSchema } from "@/schemas/goal";
import { createInvestmentSchema } from "@/schemas/investment";
import { createLendingSchema, repayLendingSchema } from "@/schemas/lending";
import { createEmiSchema } from "@/schemas/emi";
import { createSplitSchema } from "@/schemas/split";
import { createRecurringSchema } from "@/schemas/recurring";
import { markReadSchema } from "@/schemas/notification";
import { updateProfileSchema } from "@/schemas/profile";
import { saveNetWorthSnapshotSchema } from "@/schemas/netWorth";
import { isoDateSchema, cycleKeySchema, moneyInputSchema } from "@/schemas/common";

describe("Zod schemas — sanity coverage", () => {
  describe("common", () => {
    it("rejects malformed ISO dates", () => {
      expect(() => isoDateSchema.parse("2026/01/01")).toThrow();
      expect(() => isoDateSchema.parse("Jan 1, 2026")).toThrow();
      expect(() => isoDateSchema.parse("2026-1-1")).toThrow();
      expect(isoDateSchema.parse("2026-01-01")).toBe("2026-01-01");
    });

    it("validates cycleKey format", () => {
      expect(cycleKeySchema.parse("2026-06")).toBe("2026-06");
      expect(() => cycleKeySchema.parse("2026")).toThrow();
      expect(() => cycleKeySchema.parse("June 2026")).toThrow();
    });

    it("coerces string money to number", () => {
      expect(moneyInputSchema.parse("100.50")).toBe(100.5);
      expect(moneyInputSchema.parse(200)).toBe(200);
    });

    it("rejects more than 2 decimal places", () => {
      expect(() => moneyInputSchema.parse(100.123)).toThrow();
    });
  });

  describe("transactions", () => {
    it("accepts a valid transaction", () => {
      const result = createTransactionSchema.parse({
        amount: 500,
        category: "Food",
        date: "2026-06-01",
        account_id: "acc1",
        payment_type: "UPI",
      });
      expect(result.amount).toBe(500);
    });

    it("rejects zero amount", () => {
      expect(() =>
        createTransactionSchema.parse({
          amount: 0,
          category: "Food",
          date: "2026-06-01",
        })
      ).toThrow();
    });

    it("rejects self-transfer without to_account_id", () => {
      expect(() =>
        createTransactionSchema.parse({
          amount: 100,
          category: "Transfer",
          date: "2026-06-01",
          payment_type: "Self Transfer",
        })
      ).toThrow();
    });

    it("update requires at least one field", () => {
      expect(() => updateTransactionSchema.parse({})).toThrow();
      expect(() => updateTransactionSchema.parse({ amount: 50 })).not.toThrow();
    });

    it("coerces query limit", () => {
      const parsed = transactionListQuerySchema.parse({ limit: "100" });
      expect(parsed.limit).toBe(100);
    });

    it("caps query limit at 200", () => {
      expect(() => transactionListQuerySchema.parse({ limit: "500" })).toThrow();
    });
  });

  describe("accounts", () => {
    it("accepts known account types", () => {
      expect(() =>
        createAccountSchema.parse({ account_name: "Test", type: "bank", balance: 100 })
      ).not.toThrow();
    });

    it("rejects empty name", () => {
      expect(() =>
        createAccountSchema.parse({ account_name: "", type: "bank" })
      ).toThrow();
    });

    it("rejects unknown type", () => {
      expect(() =>
        createAccountSchema.parse({ account_name: "X", type: "crypto" })
      ).toThrow();
    });
  });

  describe("categories", () => {
    it("rejects invalid color", () => {
      expect(() =>
        createCategorySchema.parse({ name: "X", type: "expense", color: "blue" })
      ).toThrow();
      expect(() =>
        createCategorySchema.parse({ name: "X", type: "expense", color: "#0080ff" })
      ).not.toThrow();
    });
  });

  describe("budgets", () => {
    it("requires positive monthly_limit", () => {
      expect(() =>
        createBudgetSchema.parse({ cycleKey: "2026-06", category: "Food", monthly_limit: 0 })
      ).toThrow();
    });
  });

  describe("goals", () => {
    it("rejects past-only invalid data", () => {
      expect(() =>
        createGoalSchema.parse({
          goal_name: "Emergency Fund",
          target_amount: 100000,
          deadline: "2027-12-31",
        })
      ).not.toThrow();
    });
  });

  describe("investments", () => {
    it("defaults investment_type to Equity", () => {
      const parsed = createInvestmentSchema.parse({
        name: "ABC Fund",
        buy_price: 100,
        quantity: 10,
      });
      expect(parsed.investment_type).toBe("Equity");
    });
  });

  describe("lending", () => {
    it("validates lending type", () => {
      expect(() =>
        createLendingSchema.parse({
          type: "lent",
          person_name: "Alice",
          amount: 1000,
          date: "2026-06-01",
        })
      ).not.toThrow();
      expect(() =>
        createLendingSchema.parse({
          type: "given",
          person_name: "Alice",
          amount: 1000,
          date: "2026-06-01",
        })
      ).toThrow();
    });

    it("repay requires positive amount", () => {
      expect(() => repayLendingSchema.parse({ amount: 0 })).toThrow();
      expect(() => repayLendingSchema.parse({ amount: 500 })).not.toThrow();
    });
  });

  describe("emis", () => {
    it("requires positive tenure", () => {
      expect(() =>
        createEmiSchema.parse({
          description: "Bike loan",
          totalAmount: 100000,
          emiAmount: 2500,
          tenure: 0,
        })
      ).toThrow();
    });
  });

  describe("splits", () => {
    it("requires at least 1 participant", () => {
      expect(() =>
        createSplitSchema.parse({
          description: "Dinner",
          total_amount: 1000,
          date: "2026-06-01",
          paid_by: "Me",
          participants: [],
        })
      ).toThrow();
    });
  });

  describe("recurring", () => {
    it("validates frequency enum", () => {
      expect(() =>
        createRecurringSchema.parse({
          description: "Netflix",
          category: "Subscription",
          amount: -499,
          frequency: "biweekly",
          next_date: "2026-07-01",
        })
      ).toThrow();
      expect(() =>
        createRecurringSchema.parse({
          description: "Netflix",
          category: "Subscription",
          amount: -499,
          frequency: "monthly",
          next_date: "2026-07-01",
        })
      ).not.toThrow();
    });
  });

  describe("notifications", () => {
    it("markRead requires ids or markAllRead", () => {
      expect(() => markReadSchema.parse({})).toThrow();
      expect(() => markReadSchema.parse({ markAllRead: true })).not.toThrow();
      expect(() => markReadSchema.parse({ ids: ["abc"] })).not.toThrow();
    });
  });

  describe("profile", () => {
    it("clamps cycleStartDay range", () => {
      expect(() =>
        updateProfileSchema.parse({ cycleStartDay: 0 })
      ).toThrow();
      expect(() =>
        updateProfileSchema.parse({ cycleStartDay: 29 })
      ).toThrow();
      expect(() =>
        updateProfileSchema.parse({ cycleStartDay: 25 })
      ).not.toThrow();
    });

    it("requires at least one field", () => {
      expect(() => updateProfileSchema.parse({})).toThrow();
    });
  });

  describe("netWorth snapshots", () => {
    it("accepts complete snapshot", () => {
      expect(() =>
        saveNetWorthSnapshotSchema.parse({
          month: "2026-06",
          accounts: 100000,
          investments: 50000,
          cc_outstanding: 20000,
          lent: 5000,
          borrowed: 0,
          net_worth: 135000,
        })
      ).not.toThrow();
    });
  });
});
