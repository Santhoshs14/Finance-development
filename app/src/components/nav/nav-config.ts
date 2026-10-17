import {
  ArrowLeftRight,
  ArrowUpDown,
  BarChart3,
  Calculator,
  Calendar,
  CalendarClock,
  CalendarDays,
  ChartPie,
  CreditCard,
  Ellipsis,
  FileText,
  Gem,
  Gift,
  Handshake,
  Heart,
  House,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  LineChart,
  PieChart,
  Repeat,
  Split,
  Tags,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { CALCULATORS } from "@/components/calculators/registry";

export type NavIcon = React.ComponentType<{ className?: string; strokeWidth?: number }>;

export interface NavItem {
  label: string;
  path: string;
  icon: NavIcon;
}

export interface NavSection {
  id: string;
  label?: string;
  icon?: NavIcon;
  /** Icon-tile background used by the iOS-style More sheet. */
  tint: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "home",
    tint: "bg-chart-1",
    items: [{ label: "Home", path: "/", icon: House }],
  },
  {
    id: "money",
    label: "Money",
    icon: Landmark,
    tint: "bg-chart-3",
    items: [
      { label: "Accounts", path: "/money/accounts", icon: Landmark },
      { label: "Cash Flow", path: "/money/cash-flow", icon: ArrowUpDown },
      { label: "Transactions", path: "/money/transactions", icon: ArrowLeftRight },
      { label: "Recurring", path: "/money/recurring", icon: Repeat },
      { label: "Bills & Subs", path: "/money/bills", icon: CalendarClock },
      { label: "Debt Strategy", path: "/money/debt-strategy", icon: TrendingDown },
      { label: "Lending", path: "/money/lending", icon: Handshake },
      { label: "Splits", path: "/money/splits", icon: Split },
    ],
  },
  {
    id: "spending",
    label: "Spending",
    icon: PieChart,
    tint: "bg-chart-2",
    items: [
      { label: "Budgets", path: "/spending/budgets", icon: PieChart },
      { label: "Categories", path: "/spending/categories", icon: Tags },
      { label: "Analytics", path: "/spending/analytics", icon: BarChart3 },
    ],
  },
  {
    id: "credit",
    label: "Credit",
    icon: CreditCard,
    tint: "bg-chart-4",
    items: [
      { label: "Overview", path: "/credit", icon: CreditCard },
      { label: "Transactions", path: "/credit/transactions", icon: ArrowLeftRight },
      { label: "Statements", path: "/credit/statements", icon: FileText },
      { label: "Rewards", path: "/credit/rewards", icon: Gift },
      { label: "EMIs", path: "/credit/emis", icon: Calculator },
      { label: "Insights", path: "/credit/insights", icon: Lightbulb },
    ],
  },
  {
    id: "investments",
    label: "Investments",
    icon: TrendingUp,
    tint: "bg-chart-5",
    items: [
      { label: "Overview", path: "/investments", icon: LayoutDashboard },
      { label: "Mutual Funds", path: "/investments/mutual-funds", icon: TrendingUp },
      { label: "Gold", path: "/investments/gold", icon: Gem },
      { label: "Other", path: "/investments/other", icon: Landmark },
      { label: "Goals", path: "/investments/goals", icon: Target },
      { label: "Net Worth", path: "/investments/net-worth", icon: LineChart },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: CalendarDays,
    tint: "bg-chart-6",
    items: [
      { label: "Monthly", path: "/reports/monthly", icon: CalendarDays },
      { label: "Yearly", path: "/reports/yearly", icon: Calendar },
      { label: "Health", path: "/reports/health", icon: Heart },
    ],
  },
  {
    id: "calculators",
    tint: "bg-muted-foreground",
    items: [{ label: "Calculators", path: "/calculators", icon: Calculator }],
  },
];

export const SECTION_LABELS: Record<string, string> = {
  money: "Money",
  spending: "Spending",
  credit: "Credit",
  wealth: "Wealth",
  investments: "Investments",
  reports: "Reports",
  calculators: "Calculators",
  settings: "Settings",
};

// Section roots that have no index page redirect to their default child page.
export const SECTION_ROOTS: Record<string, string> = {
  money: "/money/accounts",
  spending: "/spending/budgets",
  credit: "/credit",
  wealth: "/investments",
  investments: "/investments",
  reports: "/reports",
  calculators: "/calculators",
  settings: "/settings",
};

export const PAGE_LABELS: Record<string, string> = {
  accounts: "Accounts",
  "cash-flow": "Cash Flow",
  transactions: "Transactions",
  bills: "Bills & Subscriptions",
  lending: "Lending",
  budgets: "Budgets",
  categories: "Categories",
  analytics: "Analytics",
  statements: "Statements",
  rewards: "Rewards",
  emis: "EMIs",
  insights: "Insights",
  portfolio: "Portfolio",
  sips: "SIPs",
  goals: "Goals",
  "net-worth": "Net Worth",
  monthly: "Monthly Review",
  yearly: "Yearly Review",
  health: "Financial Health",
  "debt-strategy": "Debt Strategy",
  splits: "Splits",
  recurring: "Recurring",
  gold: "Gold",
  "mutual-funds": "Mutual Funds",
  other: "Other Investments",
  import: "Import",
  ...Object.fromEntries(CALCULATORS.map((calc) => [calc.slug, calc.title])),
};

// Titles for top-level routes that are pages in their own right.
const ROOT_TITLES: Record<string, string> = {
  dashboard: "Home",
  money: "Money",
  spending: "Spending",
  credit: "Credit",
  "credit-cards": "Credit Cards",
  investments: "Investments",
  reports: "Reports",
  calculators: "Calculators",
  lending: "Lending",
  notifications: "Notifications",
  settings: "Settings",
  onboarding: "Welcome",
};

export type TabId = "home" | "money" | "spend" | "invest" | "more";

export interface TabItem {
  id: Exclude<TabId, "more">;
  label: string;
  href: string;
  icon: NavIcon;
}

export const TAB_ITEMS: TabItem[] = [
  { id: "home", label: "Home", href: "/", icon: House },
  { id: "money", label: "Money", href: "/money/transactions", icon: Wallet },
  { id: "spend", label: "Spend", href: "/spending/budgets", icon: ChartPie },
  { id: "invest", label: "Invest", href: "/investments", icon: TrendingUp },
];

export const MORE_TAB = { id: "more" as const, label: "More", icon: Ellipsis };

function firstSegment(pathname: string): string {
  return pathname.split("/").filter(Boolean)[0] ?? "";
}

const NAV_ITEM_PATHS = NAV_SECTIONS.flatMap((section) => section.items.map((item) => item.path));

/**
 * The single nav path that best matches the route (longest prefix), so
 * "/credit/transactions" highlights Transactions rather than Overview too.
 */
export function findActiveNavPath(pathname: string, extraPaths: string[] = []): string | undefined {
  let best: string | undefined;
  for (const path of [...NAV_ITEM_PATHS, ...extraPaths]) {
    const matches =
      path === "/"
        ? pathname === "/" || pathname === "/dashboard"
        : pathname === path || pathname.startsWith(`${path}/`);
    if (matches && (!best || path.length > best.length)) best = path;
  }
  return best;
}

/** Which bottom tab owns a route; anything without its own tab lives under More. */
export function getActiveTab(pathname: string): TabId {
  const section = firstSegment(pathname);
  if (section === "" || section === "dashboard") return "home";
  if (section === "money" || section === "lending") return "money";
  if (section === "spending") return "spend";
  if (section === "investments" || section === "wealth") return "invest";
  return "more";
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getRouteTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Home";
  const [section, page] = segments;
  if (!page) return ROOT_TITLES[section] ?? SECTION_LABELS[section] ?? titleCase(section);
  return PAGE_LABELS[page] ?? titleCase(page);
}

const ROUTES_WITH_OWN_TITLE = new Set([
  "/calculators",
  "/money/debt-strategy",
  "/money/import",
  "/money/recurring",
  "/money/splits",
  "/reports/health",
  "/reports/monthly",
  "/reports/yearly",
  "/settings",
]);

/** Pages that already render their own h1, so the shell must not add a large title. */
export function hasOwnPageTitle(pathname: string): boolean {
  return ROUTES_WITH_OWN_TITLE.has(pathname) || pathname.startsWith("/calculators/");
}
