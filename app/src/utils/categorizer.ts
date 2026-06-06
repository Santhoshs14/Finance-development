/**
 * Categorization engine — pluggable interface.
 *
 * Today, the only implementation is `KeywordCategorizer` (rule-based,
 * wraps the existing `suggestCategory` engine). The interface is built
 * so an AI engine (Vertex AI, OpenAI, on-device LLM, etc.) can be
 * swapped in without touching call sites.
 */
import { suggestCategory, getSystemRules, type CategoryRule } from "./categorization";

export interface CategorySuggestion {
  category: string;
  confidence: number; // 0..1
  source: "user" | "system" | "history" | "ai";
}

export interface CategorizerInput {
  description: string;
  amount?: number;
  merchant?: string;
}

export interface Categorizer {
  /** Suggest a category for a single transaction description. */
  suggest(
    input: CategorizerInput,
    ctx?: { availableCategories?: string[]; userRules?: CategoryRule[] }
  ): CategorySuggestion | null;
  /** Bulk version. */
  suggestMany(
    inputs: CategorizerInput[],
    ctx?: { availableCategories?: string[]; userRules?: CategoryRule[] }
  ): (CategorySuggestion | null)[];
  name: string;
}

export class KeywordCategorizer implements Categorizer {
  name = "KeywordCategorizer";

  suggest(
    input: CategorizerInput,
    ctx?: { availableCategories?: string[]; userRules?: CategoryRule[] }
  ): CategorySuggestion | null {
    const text =
      [input.merchant, input.description].filter(Boolean).join(" ").trim();
    if (!text) return null;
    const defaultCats = getSystemRules().map((r) => r.category);
    const result = suggestCategory(
      text,
      ctx?.userRules ?? [],
      ctx?.availableCategories ?? Array.from(new Set(defaultCats))
    );
    if (!result) return null;
    return {
      category: result.category,
      confidence: result.confidence,
      source: result.source,
    };
  }

  suggestMany(
    inputs: CategorizerInput[],
    ctx?: { availableCategories?: string[]; userRules?: CategoryRule[] }
  ): (CategorySuggestion | null)[] {
    return inputs.map((i) => this.suggest(i, ctx));
  }
}

/** Default singleton so call sites can use the simplest possible API. */
export const defaultCategorizer: Categorizer = new KeywordCategorizer();
