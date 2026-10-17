"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useData } from "@/providers/DataProvider";
import { fmt } from "@/utils/format";
import { CALCULATORS } from "@/components/calculators/registry";
import {
  Home, Landmark, ArrowUpDown, ArrowLeftRight, CalendarClock, Handshake,
  PieChart, Tags, BarChart3, LayoutDashboard,
  CreditCard, FileText, Gift, Calculator, Lightbulb,
  TrendingUp, TrendingDown, Repeat, Target, LineChart, Gem,
  CalendarDays, Calendar, Heart, Split,
  Settings, Search,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    label: "Home",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: Home },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Accounts", href: "/money/accounts", icon: Landmark },
      { label: "Cash Flow", href: "/money/cash-flow", icon: ArrowUpDown },
      { label: "Transactions", href: "/money/transactions", icon: ArrowLeftRight },
      { label: "Recurring", href: "/money/recurring", icon: Repeat },
      { label: "Bills & Subscriptions", href: "/money/bills", icon: CalendarClock },
      { label: "Debt Strategy", href: "/money/debt-strategy", icon: TrendingDown },
      { label: "Lending", href: "/money/lending", icon: Handshake },
      { label: "Splits", href: "/money/splits", icon: Split },
    ],
  },
  {
    label: "Spending",
    items: [
      { label: "Budgets", href: "/spending/budgets", icon: PieChart },
      { label: "Categories", href: "/spending/categories", icon: Tags },
      { label: "Analytics", href: "/spending/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Credit",
    items: [
      { label: "Credit Overview", href: "/credit", icon: CreditCard },
      { label: "Credit Transactions", href: "/credit/transactions", icon: ArrowLeftRight },
      { label: "Statements", href: "/credit/statements", icon: FileText },
      { label: "Rewards", href: "/credit/rewards", icon: Gift },
      { label: "EMIs", href: "/credit/emis", icon: Calculator },
      { label: "Credit Insights", href: "/credit/insights", icon: Lightbulb },
    ],
  },
  {
    label: "Investments",
    items: [
      { label: "Overview", href: "/investments", icon: LayoutDashboard },
      { label: "Mutual Funds", href: "/investments/mutual-funds", icon: TrendingUp },
      { label: "Gold", href: "/investments/gold", icon: Gem },
      { label: "Other", href: "/investments/other", icon: Landmark },
      { label: "Goals", href: "/investments/goals", icon: Target },
      { label: "Net Worth", href: "/investments/net-worth", icon: LineChart },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Monthly Review", href: "/reports/monthly", icon: CalendarDays },
      { label: "Yearly Review", href: "/reports/yearly", icon: Calendar },
      { label: "Financial Health", href: "/reports/health", icon: Heart },
    ],
  },
  {
    label: "Calculators",
    items: [
      { label: "All Calculators", href: "/calculators", icon: Calculator },
      ...CALCULATORS.map((calc) => ({
        label: calc.title,
        href: `/calculators/${calc.slug}`,
        icon: calc.icon,
      })),
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const COMMAND_PALETTE_OPEN_EVENT = "command-palette-open";

export function openCommandPalette() {
  document.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT));
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { transactions, accounts: _accounts, categories: _categories } = useData();

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    document.addEventListener(COMMAND_PALETTE_OPEN_EVENT, handleOpen);
    return () => document.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, handleOpen);
  }, []);

  useEffect(() => {
    let gPending = false;
    let gTimeout: ReturnType<typeof setTimeout>;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Ctrl/Cmd+K → Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") { setOpen(false); return; }

      // ? → show shortcuts hint (toggle palette)
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen(true);
        return;
      }

      // N → new transaction (QuickAdd)
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("quick-add-open"));
        return;
      }

      // G+key sequences for navigation
      if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
        gPending = true;
        clearTimeout(gTimeout);
        gTimeout = setTimeout(() => { gPending = false; }, 800);
        return;
      }

      if (gPending) {
        gPending = false;
        clearTimeout(gTimeout);
        e.preventDefault();
        const routes: Record<string, string> = {
          h: "/dashboard",
          t: "/money/transactions",
          b: "/spending/budgets",
          a: "/money/accounts",
          c: "/credit",
          w: "/investments",
          r: "/reports/monthly",
          k: "/calculators",
          s: "/settings",
          l: "/money/lending",
          g: "/investments/goals",
        };
        if (routes[e.key]) router.push(routes[e.key]);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(gTimeout);
    };
  }, [router]);

  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 5).map((t) => ({
      id: t.id,
      label: `${t.category} — ${fmt(Math.abs(t.amount))}`,
      sublabel: t.date,
    }));
  }, [transactions]);

  const navigate = (href: string) => {
    router.push(href);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/35 px-3 pt-[calc(var(--safe-top)_+_12px)] md:pt-[18vh]"
      onClick={() => setOpen(false)}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg animate-scale-in">
        <Command
          className="glass-sheet overflow-hidden rounded-[22px]"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="flex items-center gap-2 border-b border-border/60 px-4">
            <Search className="size-[18px] flex-shrink-0 text-muted-foreground" />
            <Command.Input
              placeholder="Search pages, transactions..."
              className="h-12 flex-1 bg-transparent text-body text-foreground placeholder:text-muted-foreground focus:outline-none md:text-sm"
              autoFocus
            />
            <kbd className="pointer-events-none hidden h-5 select-none items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground md:inline-flex">
              ESC
            </kbd>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="-mr-1 px-1 text-body text-brand md:hidden"
            >
              Cancel
            </button>
          </div>
          <Command.List className="max-h-[min(60dvh,420px)] overflow-y-auto overscroll-contain p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">No results found.</Command.Empty>

            {NAV_SECTIONS.map((section) => (
              <Command.Group key={section.label} heading={section.label} className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
                {section.items.map((item) => (
                  <Command.Item
                    key={item.href}
                    value={`${section.label} ${item.label}`}
                    onSelect={() => navigate(item.href)}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-subhead normal-case text-foreground transition-colors data-[selected=true]:bg-foreground/[0.06] md:py-2.5 md:text-sm"
                  >
                    <item.icon className="w-4 h-4 text-muted-foreground" />
                    {item.label}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}

            {recentTransactions.length > 0 && (
              <Command.Group heading="Recent Transactions" className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase mt-2">
                {recentTransactions.map((t) => (
                  <Command.Item
                    key={t.id}
                    value={t.label}
                    onSelect={() => navigate("/money/transactions")}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-3 text-subhead normal-case text-foreground transition-colors data-[selected=true]:bg-foreground/[0.06] md:py-2.5 md:text-sm"
                  >
                    <span>{t.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{t.sublabel}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
