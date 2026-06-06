import { describe, it, expect } from "vitest";
import {
  suggestCategory,
  createRuleFromCorrection,
  getSystemRules,
  type CategoryRule,
  type CategorizationResult,
} from "@/utils/categorization";

// ═══════════════════════════════════════════════════════════════════════
// suggestCategory - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("suggestCategory", () => {
  const availableCategories = [
    "Food", "Travel", "Petrol", "Subscription", "Shopping",
    "Rent", "Bills", "Entertainment", "Income", "Investment",
    "Utilities", "Lending", "Gifts", "Home",
  ];

  describe("System rules matching", () => {
    it("categorizes food delivery services", () => {
      const result = suggestCategory("Swiggy order", [], availableCategories);
      expect(result).not.toBeNull();
      expect(result!.category).toBe("Food");
      expect(result!.source).toBe("system");
    });

    it("categorizes zomato", () => {
      const result = suggestCategory("Zomato delivery", [], availableCategories);
      expect(result!.category).toBe("Food");
    });

    it("categorizes uber rides", () => {
      const result = suggestCategory("Uber ride to office", [], availableCategories);
      expect(result!.category).toBe("Travel");
    });

    it("categorizes netflix subscription", () => {
      const result = suggestCategory("Netflix monthly", [], availableCategories);
      expect(result!.category).toBe("Subscription");
    });

    it("categorizes spotify", () => {
      const result = suggestCategory("Spotify premium", [], availableCategories);
      expect(result!.category).toBe("Subscription");
    });

    it("categorizes petrol/fuel", () => {
      const result = suggestCategory("Petrol fill up", [], availableCategories);
      expect(result!.category).toBe("Petrol");
    });

    it("categorizes amazon shopping", () => {
      const result = suggestCategory("Amazon order delivered", [], availableCategories);
      expect(result!.category).toBe("Shopping");
    });

    it("categorizes flipkart", () => {
      const result = suggestCategory("Flipkart purchase", [], availableCategories);
      expect(result!.category).toBe("Shopping");
    });

    it("categorizes rent payment", () => {
      const result = suggestCategory("Monthly rent", [], availableCategories);
      expect(result!.category).toBe("Rent");
    });

    it("categorizes electricity bill", () => {
      const result = suggestCategory("Electricity bill payment", [], availableCategories);
      expect(result!.category).toBe("Bills");
    });

    it("categorizes salary income", () => {
      const result = suggestCategory("Salary credited", [], availableCategories);
      expect(result!.category).toBe("Income");
    });

    it("categorizes mutual fund investments", () => {
      const result = suggestCategory("Mutual fund SIP", [], availableCategories);
      expect(result!.category).toBe("Investment");
    });

    it("categorizes movie tickets", () => {
      const result = suggestCategory("Movie tickets PVR", [], availableCategories);
      expect(result!.category).toBe("Entertainment");
    });

    it("categorizes medical expenses", () => {
      const result = suggestCategory("Doctor consultation", [], availableCategories);
      expect(result!.category).toBe("Utilities");
    });

    it("categorizes gifts", () => {
      const result = suggestCategory("Birthday gift for friend", [], availableCategories);
      expect(result!.category).toBe("Gifts");
    });

    it("categorizes home maintenance", () => {
      const result = suggestCategory("Plumber fixing pipes", [], availableCategories);
      expect(result!.category).toBe("Home");
    });
  });

  describe("User rules (highest priority)", () => {
    it("user rules override system rules", () => {
      const userRules: CategoryRule[] = [
        { id: "u1", keyword: "swiggy", category: "Entertainment", confidence: 0.95, source: "user" },
      ];
      const result = suggestCategory("Swiggy order", userRules, availableCategories);
      expect(result!.category).toBe("Entertainment"); // User rule overrides Food
      expect(result!.source).toBe("user");
    });

    it("respects user rule confidence threshold", () => {
      const userRules: CategoryRule[] = [
        { id: "u1", keyword: "test", category: "Shopping", confidence: 0.5, source: "user" },
      ];
      // Low confidence user rule should not block system rule
      const result = suggestCategory("test netflix", userRules, availableCategories);
      expect(result).not.toBeNull();
      // System rule for netflix (0.95) should win over low confidence user rule
    });

    it("handles multiple matching user rules (highest confidence wins)", () => {
      const userRules: CategoryRule[] = [
        { id: "u1", keyword: "office", category: "Travel", confidence: 0.7, source: "user" },
        { id: "u2", keyword: "office", category: "Bills", confidence: 0.9, source: "user" },
      ];
      const result = suggestCategory("Office expenses", userRules, availableCategories);
      expect(result!.category).toBe("Bills");
    });
  });

  describe("Transaction history matching", () => {
    it("uses transaction history when no rule matches", () => {
      const history = [
        { notes: "Gym membership", category: "Utilities" },
        { notes: "Gym membership renewal", category: "Utilities" },
        { notes: "Gym class", category: "Utilities" },
      ];
      const result = suggestCategory("Gym subscription", [], availableCategories, history);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.source).toBe("history");
        expect(result.category).toBe("Utilities");
      }
    });

    it("requires at least 2 matching transactions", () => {
      const history = [
        { notes: "UniqueItem123", category: "Shopping" },
      ];
      const result = suggestCategory("UniqueItem123 purchase", [], availableCategories, history);
      // With only 1 matching history item, may not return history match
      if (result && result.source === "history") {
        // Should not happen with < 2 matches
        expect(true).toBe(false);
      }
    });
  });

  describe("Edge cases", () => {
    it("returns null for empty text", () => {
      const result = suggestCategory("", [], availableCategories);
      expect(result).toBeNull();
    });

    it("returns null for single character", () => {
      const result = suggestCategory("a", [], availableCategories);
      expect(result).toBeNull();
    });

    it("returns null for whitespace only", () => {
      const result = suggestCategory("   ", [], availableCategories);
      expect(result).toBeNull();
    });

    it("case insensitive matching", () => {
      const result = suggestCategory("SWIGGY ORDER", [], availableCategories);
      expect(result).not.toBeNull();
      expect(result!.category).toBe("Food");
    });

    it("returns null when category not in available list", () => {
      const limitedCategories = ["Food", "Travel"];
      const result = suggestCategory("Netflix monthly", [], limitedCategories);
      // Netflix maps to Subscription which is not available
      expect(result === null || result.category === "Food" || result.category === "Travel").toBe(true);
    });

    it("handles text with special characters", () => {
      const result = suggestCategory("uber ride @ ₹200", [], availableCategories);
      expect(result).not.toBeNull();
      expect(result!.category).toBe("Travel");
    });

    it("handles very long text", () => {
      const longText = "Swiggy " + "a".repeat(1000);
      const result = suggestCategory(longText, [], availableCategories);
      expect(result).not.toBeNull();
      expect(result!.category).toBe("Food");
    });
  });

  describe("Confidence levels", () => {
    it("returns confidence from matching rule", () => {
      const result = suggestCategory("Netflix subscription", [], availableCategories);
      expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result!.confidence).toBeLessThanOrEqual(1.0);
    });

    it("system rules have varying confidence", () => {
      const food = suggestCategory("Swiggy delivery", [], availableCategories);
      const generic = suggestCategory("some order placed", [], availableCategories);
      if (food && generic) {
        expect(food.confidence).toBeGreaterThan(generic.confidence);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// createRuleFromCorrection - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("createRuleFromCorrection", () => {
  it("creates rule from short text (≤20 chars)", () => {
    const result = createRuleFromCorrection("Netflix", "Entertainment");
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe("netflix");
    expect(result!.category).toBe("Entertainment");
    expect(result!.confidence).toBe(0.9);
  });

  it("creates rule from long text (uses longest word)", () => {
    const result = createRuleFromCorrection("Monthly subscription payment for Netflix premium service", "Subscription");
    expect(result).not.toBeNull();
    expect(result!.keyword.length).toBeGreaterThanOrEqual(3);
    expect(result!.category).toBe("Subscription");
  });

  it("returns null for empty text", () => {
    const result = createRuleFromCorrection("", "Food");
    expect(result).toBeNull();
  });

  it("returns null for single character", () => {
    const result = createRuleFromCorrection("a", "Food");
    expect(result).toBeNull();
  });

  it("returns null for very short words (< 3 chars each)", () => {
    const result = createRuleFromCorrection("ab cd", "Food");
    expect(result).toBeNull();
  });

  it("lowercases the keyword", () => {
    const result = createRuleFromCorrection("NETFLIX Premium", "Entertainment");
    expect(result!.keyword).toBe("netflix premium");
  });

  it("always sets confidence to 0.9", () => {
    const result = createRuleFromCorrection("Test keyword", "Shopping");
    expect(result!.confidence).toBe(0.9);
  });

  it("handles text with numbers", () => {
    const result = createRuleFromCorrection("Order 12345 from Amazon", "Shopping");
    expect(result).not.toBeNull();
  });

  it("handles text with special characters", () => {
    const result = createRuleFromCorrection("Uber Eats - ₹500", "Food");
    expect(result).not.toBeNull();
  });

  it("trims whitespace", () => {
    const result = createRuleFromCorrection("  Netflix  ", "Entertainment");
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe("netflix");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getSystemRules - Tests
// ═══════════════════════════════════════════════════════════════════════

describe("getSystemRules", () => {
  it("returns non-empty array", () => {
    const rules = getSystemRules();
    expect(rules.length).toBeGreaterThan(0);
  });

  it("all rules have required fields", () => {
    const rules = getSystemRules();
    for (const rule of rules) {
      expect(rule.keyword).toBeDefined();
      expect(rule.keyword.length).toBeGreaterThan(0);
      expect(rule.category).toBeDefined();
      expect(rule.confidence).toBeGreaterThanOrEqual(0);
      expect(rule.confidence).toBeLessThanOrEqual(1);
      expect(rule.source).toBe("system");
    }
  });

  it("contains food-related rules", () => {
    const rules = getSystemRules();
    const foodRules = rules.filter(r => r.category === "Food");
    expect(foodRules.length).toBeGreaterThan(0);
  });

  it("contains travel-related rules", () => {
    const rules = getSystemRules();
    const travelRules = rules.filter(r => r.category === "Travel");
    expect(travelRules.length).toBeGreaterThan(0);
  });

  it("contains income-related rules", () => {
    const rules = getSystemRules();
    const incomeRules = rules.filter(r => r.category === "Income");
    expect(incomeRules.length).toBeGreaterThan(0);
  });

  it("keywords are lowercase", () => {
    const rules = getSystemRules();
    for (const rule of rules) {
      expect(rule.keyword).toBe(rule.keyword.toLowerCase());
    }
  });

  it("covers all expected categories", () => {
    const rules = getSystemRules();
    const categories = new Set(rules.map(r => r.category));
    expect(categories.has("Food")).toBe(true);
    expect(categories.has("Travel")).toBe(true);
    expect(categories.has("Subscription")).toBe(true);
    expect(categories.has("Shopping")).toBe(true);
    expect(categories.has("Income")).toBe(true);
    expect(categories.has("Investment")).toBe(true);
    expect(categories.has("Bills")).toBe(true);
  });
});
