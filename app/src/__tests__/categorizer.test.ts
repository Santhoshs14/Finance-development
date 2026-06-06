import { describe, it, expect } from "vitest";
import { KeywordCategorizer, defaultCategorizer } from "@/utils/categorizer";

describe("KeywordCategorizer (Categorizer interface)", () => {
  it("returns null for empty input", () => {
    const c = new KeywordCategorizer();
    expect(c.suggest({ description: "" })).toBeNull();
  });

  it("matches well-known keywords (swiggy → Food)", () => {
    const c = new KeywordCategorizer();
    const res = c.suggest({ description: "Swiggy order #12345" });
    expect(res).not.toBeNull();
    expect(res!.category).toBe("Food");
  });

  it("returns null for completely unknown text", () => {
    const c = new KeywordCategorizer();
    expect(c.suggest({ description: "xyzqwertyrandom" })).toBeNull();
  });

  it("bulk suggestion mirrors single suggestion", () => {
    const c = new KeywordCategorizer();
    const out = c.suggestMany([
      { description: "Uber ride" },
      { description: "" },
      { description: "Zomato" },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0]?.category).toBe("Travel");
    expect(out[1]).toBeNull();
    expect(out[2]?.category).toBe("Food");
  });

  it("default categorizer is a KeywordCategorizer instance", () => {
    expect(defaultCategorizer.name).toBe("KeywordCategorizer");
  });
});
