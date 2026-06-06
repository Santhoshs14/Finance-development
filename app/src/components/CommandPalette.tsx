"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useData } from "@/providers/DataProvider";
import { fmt } from "@/utils/format";
import {
  Home, Landmark, ArrowUpDown, ArrowLeftRight, CalendarClock, Handshake,
  PieChart, Tags, BarChart3,
  CreditCard, FileText, Gift, Calculator, Lightbulb,
  TrendingUp, TrendingDown, Repeat, Target, LineChart, Gem,
  CalendarDays, Calendar, Heart, Shield, Split,
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
    label: "Wealth",
    items: [
      { label: "Portfolio", href: "/wealth/portfolio", icon: TrendingUp },
      { label: "SIPs", href: "/wealth/sips", icon: Repeat },
      { label: "Goals", href: "/wealth/goals", icon: Target },
      { label: "Net Worth", href: "/wealth/net-worth", icon: LineChart },
      { label: "Gold", href: "/wealth/gold", icon: Gem },
      { label: "Retirement", href: "/wealth/retirement", icon: Calculator },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Monthly Review", href: "/reports/monthly", icon: CalendarDays },
      { label: "Yearly Review", href: "/reports/yearly", icon: Calendar },
      { label: "Financial Health", href: "/reports/health", icon: Heart },
      { label: "Tax Calculator", href: "/reports/tax", icon: Shield },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { transactions, accounts: _accounts, categories: _categories } = useData();

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
          w: "/wealth/portfolio",
          r: "/reports/monthly",
          s: "/settings",
          l: "/money/lending",
          g: "/wealth/goals",
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
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg mx-4">
        <Command className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Command.Input
              placeholder="Search pages, transactions..."
              className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-[320px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">No results found.</Command.Empty>

            {NAV_SECTIONS.map((section) => (
              <Command.Group key={section.label} heading={section.label} className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
                {section.items.map((item) => (
                  <Command.Item
                    key={item.href}
                    value={`${section.label} ${item.label}`}
                    onSelect={() => navigate(item.href)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground cursor-pointer data-[selected=true]:bg-muted transition-colors"
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
                    onSelect={() => navigate("/transactions")}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-foreground cursor-pointer data-[selected=true]:bg-muted transition-colors"
                  >
                    <span>{t.label}</span>
                    <span className="text-xs text-muted-foreground">{t.sublabel}</span>
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
