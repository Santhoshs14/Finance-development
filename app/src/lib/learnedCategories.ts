/**
 * Per-device learned categorization rules.
 *
 * Persists the (notes → category) associations a user implicitly creates each
 * time they add a transaction, so the categorization engine can suggest the
 * same category for similar future notes. Storage is localStorage (per device,
 * no backend) and every access is guarded so it is safe on the server and when
 * storage is unavailable/disabled.
 */
import { createRuleFromCorrection, type CategoryRule } from "@/utils/categorization";

const STORAGE_KEY = "wf-learned-category-rules";
const MAX_RULES = 200;

function readRaw(): CategoryRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is CategoryRule =>
        !!r &&
        typeof (r as CategoryRule).keyword === "string" &&
        typeof (r as CategoryRule).category === "string"
    );
  } catch {
    return [];
  }
}

/** Load all learned rules for this device (newest first). */
export function loadLearnedRules(): CategoryRule[] {
  return readRaw();
}

/**
 * Record a user's notes → category association as a high-confidence learned
 * rule. Dedupes by keyword (latest category wins), caps the store size, and
 * persists. Returns the updated rule list. No-ops safely when the text is too
 * short to derive a keyword or when storage is unavailable.
 */
export function learnCategoryRule(text: string, category: string): CategoryRule[] {
  const existing = readRaw();
  const derived = createRuleFromCorrection(text, category);
  if (!derived) return existing;

  const keyword = derived.keyword.toLowerCase();
  const next: CategoryRule[] = [
    {
      id: `user-${keyword}`,
      keyword: derived.keyword,
      category: derived.category,
      confidence: derived.confidence,
      source: "user" as const,
    },
    ...existing.filter((r) => r.keyword.toLowerCase() !== keyword),
  ].slice(0, MAX_RULES);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors / disabled storage — suggestions just won't persist.
    }
  }
  return next;
}
