/**
 * categorization.ts
 * Smart auto-categorization engine with keyword matching + user-learned rules.
 * Priority: user rules > keyword map > null
 */

export interface CategoryRule {
  id: string;
  keyword: string;
  category: string;
  confidence: number; // 0-1, higher = more reliable
  source: "system" | "user";
}

// Default system keyword → category rules
const SYSTEM_RULES: Omit<CategoryRule, "id">[] = [
  // Food & Dining
  { keyword: "swiggy", category: "Food", confidence: 0.95, source: "system" },
  { keyword: "zomato", category: "Food", confidence: 0.95, source: "system" },
  { keyword: "mcdonalds", category: "Food", confidence: 0.9, source: "system" },
  { keyword: "kfc", category: "Food", confidence: 0.9, source: "system" },
  { keyword: "pizza", category: "Food", confidence: 0.85, source: "system" },
  { keyword: "burger", category: "Food", confidence: 0.85, source: "system" },
  { keyword: "restaurant", category: "Food", confidence: 0.9, source: "system" },
  { keyword: "cafe", category: "Food", confidence: 0.85, source: "system" },
  { keyword: "lunch", category: "Food", confidence: 0.8, source: "system" },
  { keyword: "dinner", category: "Food", confidence: 0.8, source: "system" },
  { keyword: "breakfast", category: "Food", confidence: 0.8, source: "system" },
  { keyword: "biryani", category: "Food", confidence: 0.9, source: "system" },
  { keyword: "dominos", category: "Food", confidence: 0.9, source: "system" },
  { keyword: "starbucks", category: "Food", confidence: 0.9, source: "system" },
  { keyword: "chai", category: "Food", confidence: 0.7, source: "system" },
  { keyword: "snack", category: "Food", confidence: 0.8, source: "system" },
  { keyword: "groceries", category: "Food", confidence: 0.85, source: "system" },
  { keyword: "bigbasket", category: "Food", confidence: 0.9, source: "system" },
  { keyword: "blinkit", category: "Food", confidence: 0.85, source: "system" },
  { keyword: "zepto", category: "Food", confidence: 0.85, source: "system" },
  { keyword: "instamart", category: "Food", confidence: 0.85, source: "system" },

  // Travel & Transport
  { keyword: "uber", category: "Travel", confidence: 0.9, source: "system" },
  { keyword: "ola", category: "Travel", confidence: 0.9, source: "system" },
  { keyword: "rapido", category: "Travel", confidence: 0.9, source: "system" },
  { keyword: "auto", category: "Travel", confidence: 0.7, source: "system" },
  { keyword: "cab", category: "Travel", confidence: 0.85, source: "system" },
  { keyword: "taxi", category: "Travel", confidence: 0.85, source: "system" },
  { keyword: "metro", category: "Travel", confidence: 0.85, source: "system" },
  { keyword: "bus", category: "Travel", confidence: 0.7, source: "system" },
  { keyword: "train", category: "Travel", confidence: 0.8, source: "system" },
  { keyword: "flight", category: "Travel", confidence: 0.9, source: "system" },
  { keyword: "irctc", category: "Travel", confidence: 0.95, source: "system" },
  { keyword: "makemytrip", category: "Travel", confidence: 0.9, source: "system" },
  { keyword: "goibibo", category: "Travel", confidence: 0.9, source: "system" },
  { keyword: "toll", category: "Travel", confidence: 0.8, source: "system" },
  { keyword: "parking", category: "Travel", confidence: 0.75, source: "system" },

  // Petrol
  { keyword: "petrol", category: "Petrol", confidence: 0.95, source: "system" },
  { keyword: "fuel", category: "Petrol", confidence: 0.9, source: "system" },
  { keyword: "diesel", category: "Petrol", confidence: 0.9, source: "system" },
  { keyword: "pump", category: "Petrol", confidence: 0.7, source: "system" },
  { keyword: "hp pump", category: "Petrol", confidence: 0.9, source: "system" },
  { keyword: "indian oil", category: "Petrol", confidence: 0.9, source: "system" },
  { keyword: "bharat petroleum", category: "Petrol", confidence: 0.9, source: "system" },

  // Subscriptions
  { keyword: "netflix", category: "Subscription", confidence: 0.95, source: "system" },
  { keyword: "prime", category: "Subscription", confidence: 0.8, source: "system" },
  { keyword: "hotstar", category: "Subscription", confidence: 0.95, source: "system" },
  { keyword: "spotify", category: "Subscription", confidence: 0.95, source: "system" },
  { keyword: "youtube premium", category: "Subscription", confidence: 0.95, source: "system" },
  { keyword: "apple music", category: "Subscription", confidence: 0.95, source: "system" },
  { keyword: "disney+", category: "Subscription", confidence: 0.95, source: "system" },
  { keyword: "jio", category: "Subscription", confidence: 0.7, source: "system" },
  { keyword: "airtel", category: "Subscription", confidence: 0.7, source: "system" },

  // Shopping
  { keyword: "amazon", category: "Shopping", confidence: 0.85, source: "system" },
  { keyword: "flipkart", category: "Shopping", confidence: 0.9, source: "system" },
  { keyword: "myntra", category: "Shopping", confidence: 0.9, source: "system" },
  { keyword: "ajio", category: "Shopping", confidence: 0.9, source: "system" },
  { keyword: "meesho", category: "Shopping", confidence: 0.9, source: "system" },
  { keyword: "nykaa", category: "Shopping", confidence: 0.9, source: "system" },
  { keyword: "shop", category: "Shopping", confidence: 0.6, source: "system" },
  { keyword: "order", category: "Shopping", confidence: 0.5, source: "system" },
  { keyword: "clothes", category: "Shopping", confidence: 0.8, source: "system" },

  // Rent
  { keyword: "rent", category: "Rent", confidence: 0.9, source: "system" },
  { keyword: "landlord", category: "Rent", confidence: 0.9, source: "system" },

  // Bills & Utilities
  { keyword: "electricity", category: "Bills", confidence: 0.95, source: "system" },
  { keyword: "water bill", category: "Bills", confidence: 0.95, source: "system" },
  { keyword: "wifi", category: "Bills", confidence: 0.9, source: "system" },
  { keyword: "internet", category: "Bills", confidence: 0.85, source: "system" },
  { keyword: "broadband", category: "Bills", confidence: 0.9, source: "system" },
  { keyword: "recharge", category: "Bills", confidence: 0.8, source: "system" },
  { keyword: "gas bill", category: "Bills", confidence: 0.9, source: "system" },
  { keyword: "maintenance", category: "Bills", confidence: 0.75, source: "system" },

  // Entertainment
  { keyword: "movie", category: "Entertainment", confidence: 0.85, source: "system" },
  { keyword: "cinema", category: "Entertainment", confidence: 0.9, source: "system" },
  { keyword: "concert", category: "Entertainment", confidence: 0.9, source: "system" },
  { keyword: "bookmyshow", category: "Entertainment", confidence: 0.95, source: "system" },
  { keyword: "party", category: "Entertainment", confidence: 0.7, source: "system" },
  { keyword: "game", category: "Entertainment", confidence: 0.7, source: "system" },

  // Income
  { keyword: "salary", category: "Income", confidence: 0.95, source: "system" },
  { keyword: "income", category: "Income", confidence: 0.9, source: "system" },
  { keyword: "bonus", category: "Income", confidence: 0.9, source: "system" },
  { keyword: "cashback", category: "Income", confidence: 0.8, source: "system" },
  { keyword: "refund", category: "Income", confidence: 0.8, source: "system" },
  { keyword: "freelance", category: "Income", confidence: 0.9, source: "system" },
  { keyword: "dividend", category: "Income", confidence: 0.9, source: "system" },
  { keyword: "interest", category: "Income", confidence: 0.7, source: "system" },

  // Investments
  { keyword: "mutual fund", category: "Investment", confidence: 0.95, source: "system" },
  { keyword: "sip", category: "Investment", confidence: 0.9, source: "system" },
  { keyword: "stocks", category: "Investment", confidence: 0.9, source: "system" },
  { keyword: "zerodha", category: "Investment", confidence: 0.95, source: "system" },
  { keyword: "groww", category: "Investment", confidence: 0.95, source: "system" },
  { keyword: "kuvera", category: "Investment", confidence: 0.95, source: "system" },
  { keyword: "ppf", category: "Investment", confidence: 0.9, source: "system" },
  { keyword: "fd", category: "Investment", confidence: 0.75, source: "system" },
  { keyword: "nps", category: "Investment", confidence: 0.9, source: "system" },

  // Health/Medical
  { keyword: "medicine", category: "Utilities", confidence: 0.85, source: "system" },
  { keyword: "doctor", category: "Utilities", confidence: 0.9, source: "system" },
  { keyword: "hospital", category: "Utilities", confidence: 0.9, source: "system" },
  { keyword: "pharmacy", category: "Utilities", confidence: 0.9, source: "system" },
  { keyword: "apollo", category: "Utilities", confidence: 0.85, source: "system" },
  { keyword: "pharmeasy", category: "Utilities", confidence: 0.9, source: "system" },
  { keyword: "1mg", category: "Utilities", confidence: 0.9, source: "system" },

  // Lending
  { keyword: "lend", category: "Lending", confidence: 0.8, source: "system" },
  { keyword: "loan", category: "Lending", confidence: 0.75, source: "system" },
  { keyword: "borrow", category: "Lending", confidence: 0.8, source: "system" },
  { keyword: "emi", category: "Lending", confidence: 0.7, source: "system" },

  // Gifts
  { keyword: "gift", category: "Gifts", confidence: 0.85, source: "system" },
  { keyword: "wedding", category: "Gifts", confidence: 0.7, source: "system" },
  { keyword: "birthday", category: "Gifts", confidence: 0.75, source: "system" },
  { keyword: "present", category: "Gifts", confidence: 0.75, source: "system" },

  // Home
  { keyword: "furniture", category: "Home", confidence: 0.85, source: "system" },
  { keyword: "ikea", category: "Home", confidence: 0.9, source: "system" },
  { keyword: "repair", category: "Home", confidence: 0.7, source: "system" },
  { keyword: "plumber", category: "Home", confidence: 0.85, source: "system" },
  { keyword: "electrician", category: "Home", confidence: 0.85, source: "system" },
  { keyword: "maid", category: "Home", confidence: 0.8, source: "system" },
  { keyword: "cleaning", category: "Home", confidence: 0.7, source: "system" },
];

export interface CategorizationResult {
  category: string;
  confidence: number;
  source: "user" | "system" | "history";
}

/**
 * Suggest a category based on notes/description text.
 * Priority: user rules (highest confidence) > system rules > transaction history patterns
 */
export function suggestCategory(
  text: string,
  userRules: CategoryRule[],
  availableCategories: string[],
  transactionHistory?: Array<{ notes?: string; description?: string; category: string }>
): CategorizationResult | null {
  if (!text || text.trim().length < 2) return null;
  const lower = text.toLowerCase().trim();

  // 1. Check user-defined rules first (highest priority)
  let bestMatch: CategorizationResult | null = null;

  for (const rule of userRules) {
    if (lower.includes(rule.keyword.toLowerCase())) {
      if (availableCategories.includes(rule.category)) {
        if (!bestMatch || rule.confidence > bestMatch.confidence) {
          bestMatch = { category: rule.category, confidence: rule.confidence, source: "user" };
        }
      }
    }
  }

  if (bestMatch && bestMatch.confidence >= 0.8) return bestMatch;

  // 2. Check system rules
  for (const rule of SYSTEM_RULES) {
    if (lower.includes(rule.keyword)) {
      if (availableCategories.includes(rule.category)) {
        if (!bestMatch || rule.confidence > bestMatch.confidence) {
          bestMatch = { category: rule.category, confidence: rule.confidence, source: "system" };
        }
      }
    }
  }

  if (bestMatch && bestMatch.confidence >= 0.7) return bestMatch;

  // 3. Check transaction history for matching patterns
  if (transactionHistory && transactionHistory.length > 0) {
    const matchingTxns = transactionHistory.filter((t) => {
      const txText = ((t.notes || "") + " " + (t.description || "")).toLowerCase();
      // Check if there's significant overlap
      const words = lower.split(/\s+/).filter((w) => w.length >= 3);
      return words.some((word) => txText.includes(word));
    });

    if (matchingTxns.length >= 2) {
      // Count category occurrences
      const catCount: Record<string, number> = {};
      matchingTxns.forEach((t) => {
        catCount[t.category] = (catCount[t.category] || 0) + 1;
      });

      const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
      if (topCat && topCat[1] >= 2 && availableCategories.includes(topCat[0])) {
        const historyConfidence = Math.min(0.85, 0.5 + topCat[1] * 0.1);
        if (!bestMatch || historyConfidence > bestMatch.confidence) {
          bestMatch = { category: topCat[0], confidence: historyConfidence, source: "history" };
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Learn a new rule from user correction.
 * When user picks a different category than suggested, create/update a rule.
 */
export function createRuleFromCorrection(
  text: string,
  chosenCategory: string
): { keyword: string; category: string; confidence: number } | null {
  if (!text || text.trim().length < 2) return null;
  // Extract the most meaningful keyword (longest word >= 3 chars)
  const words = text.toLowerCase().trim().split(/\s+/).filter((w) => w.length >= 3);
  if (words.length === 0) return null;

  // Use the full text if short, otherwise the longest meaningful word
  const keyword = text.trim().length <= 20
    ? text.trim().toLowerCase()
    : words.sort((a, b) => b.length - a.length)[0];

  return {
    keyword,
    category: chosenCategory,
    confidence: 0.9, // User corrections have high confidence
  };
}

/**
 * Get the system rules (for admin/debug view)
 */
export function getSystemRules(): Omit<CategoryRule, "id">[] {
  return SYSTEM_RULES;
}
