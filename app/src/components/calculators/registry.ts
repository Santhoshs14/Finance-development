import {
  ArrowRightLeft,
  Banknote,
  Building2,
  CalendarClock,
  Coins,
  Flame,
  Gift,
  Home,
  Landmark,
  LineChart,
  PiggyBank,
  Receipt,
  Shield,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";

export interface CalculatorMeta {
  slug: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
}

/**
 * Single source of truth for the Calculators section — consumed by the landing
 * grid, the Sidebar and the Command Palette so routes are registered once.
 */
export const CALCULATORS: CalculatorMeta[] = [
  {
    slug: "cagr",
    title: "CAGR & XIRR",
    description: "Annualised return on an investment, or IRR across dated cashflows.",
    icon: LineChart,
    keywords: ["cagr", "xirr", "irr", "returns", "annualised", "growth rate"],
  },
  {
    slug: "emi",
    title: "EMI Calculator",
    description: "Loan instalment, total interest and a full amortisation schedule.",
    icon: Receipt,
    keywords: ["emi", "loan", "home loan", "car loan", "amortisation", "interest"],
  },
  {
    slug: "epf",
    title: "EPF Calculator",
    description: "Provident fund corpus at retirement from your basic salary.",
    icon: Building2,
    keywords: ["epf", "pf", "provident fund", "employer", "retirement"],
  },
  {
    slug: "fd",
    title: "FD Calculator",
    description: "Fixed deposit maturity value and interest at any compounding frequency.",
    icon: Landmark,
    keywords: ["fd", "fixed deposit", "maturity", "interest", "bank"],
  },
  {
    slug: "goal",
    title: "Goal Planner",
    description: "The monthly SIP or lump sum needed to hit an inflation-adjusted target.",
    icon: Target,
    keywords: ["goal", "target", "planning", "savings", "milestone"],
  },
  {
    slug: "gratuity",
    title: "Gratuity Calculator",
    description: "Statutory gratuity payable on your last drawn salary and tenure.",
    icon: Gift,
    keywords: ["gratuity", "exit", "resignation", "tenure", "salary"],
  },
  {
    slug: "hra",
    title: "HRA Exemption",
    description: "House rent allowance exempt under Section 10(13A).",
    icon: Home,
    keywords: ["hra", "rent", "house rent", "exemption", "10(13a)", "metro"],
  },
  {
    slug: "income-tax",
    title: "Income Tax Calculator",
    description: "Compare your liability under the old and new regimes for the year.",
    icon: Shield,
    keywords: ["income tax", "tax", "regime", "80c", "slab", "deduction"],
  },
  {
    slug: "inflation",
    title: "Inflation Calculator",
    description: "What today's money will cost, and be worth, years from now.",
    icon: Flame,
    keywords: ["inflation", "purchasing power", "cost of living", "future value"],
  },
  {
    slug: "lumpsum",
    title: "Lumpsum Calculator",
    description: "Future value and returns on a one-time investment.",
    icon: Coins,
    keywords: ["lumpsum", "one time", "future value", "compound", "invest"],
  },
  {
    slug: "nps",
    title: "NPS Calculator",
    description: "Retirement corpus, lump sum withdrawal and monthly pension.",
    icon: Shield,
    keywords: ["nps", "pension", "annuity", "retirement", "tier 1"],
  },
  {
    slug: "ppf",
    title: "PPF Calculator",
    description: "Public Provident Fund maturity value over the 15-year lock-in.",
    icon: PiggyBank,
    keywords: ["ppf", "public provident fund", "80c", "tax free", "15 years"],
  },
  {
    slug: "rd",
    title: "RD Calculator",
    description: "Recurring deposit maturity value from a fixed monthly deposit.",
    icon: CalendarClock,
    keywords: ["rd", "recurring deposit", "monthly", "maturity", "bank"],
  },
  {
    slug: "retirement",
    title: "Retirement Calculator",
    description: "Corpus needed for financial independence, across return scenarios.",
    icon: Wallet,
    keywords: ["retirement", "fire", "corpus", "independence", "pension"],
  },
  {
    slug: "sip",
    title: "SIP Calculator",
    description: "Maturity value of a monthly systematic investment, with step-up.",
    icon: TrendingUp,
    keywords: ["sip", "systematic", "monthly", "mutual fund", "step up"],
  },
  {
    slug: "stp",
    title: "STP Calculator",
    description: "Systematic transfers from a debt fund into an equity fund.",
    icon: ArrowRightLeft,
    keywords: ["stp", "transfer", "debt", "equity", "mutual fund"],
  },
  {
    slug: "swp",
    title: "SWP Calculator",
    description: "How long a corpus lasts against a regular monthly withdrawal.",
    icon: Banknote,
    keywords: ["swp", "withdrawal", "income", "drawdown", "corpus"],
  },
];

export const CALCULATOR_BY_SLUG: Record<string, CalculatorMeta> =
  Object.fromEntries(CALCULATORS.map((c) => [c.slug, c]));
