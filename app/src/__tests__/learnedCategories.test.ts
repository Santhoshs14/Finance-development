import { describe, it, expect, beforeEach } from "vitest";
import { loadLearnedRules, learnCategoryRule } from "@/lib/learnedCategories";
import { suggestCategory } from "@/utils/categorization";

describe("learnedCategories", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty list when nothing is stored", () => {
    expect(loadLearnedRules()).toEqual([]);
  });

  it("learns and persists a rule from a notes -> category correction", () => {
    const rules = learnCategoryRule("Blinkit groceries", "Food");
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ category: "Food", source: "user" });
    expect(loadLearnedRules()).toHaveLength(1);
  });

  it("dedupes by keyword, keeping the latest category", () => {
    learnCategoryRule("Amazon", "Shopping");
    const rules = learnCategoryRule("Amazon", "Subscription");
    const amazon = rules.filter((r) => r.keyword.toLowerCase() === "amazon");
    expect(amazon).toHaveLength(1);
    expect(amazon[0].category).toBe("Subscription");
  });

  it("ignores text too short to derive a keyword", () => {
    expect(learnCategoryRule("a", "Food")).toEqual([]);
    expect(loadLearnedRules()).toEqual([]);
  });

  it("recovers gracefully from corrupt stored data", () => {
    window.localStorage.setItem("wf-learned-category-rules", "{not json");
    expect(loadLearnedRules()).toEqual([]);
  });

  it("a learned rule overrides a system rule in the engine", () => {
    // 'zomato' maps to Food in the system rules; teach it to map to Dining.
    learnCategoryRule("zomato", "Dining");
    const result = suggestCategory("zomato order", loadLearnedRules(), [
      "Food",
      "Dining",
    ]);
    expect(result?.category).toBe("Dining");
    expect(result?.source).toBe("user");
  });
});
