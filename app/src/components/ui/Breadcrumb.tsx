"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const sectionLabels: Record<string, string> = {
  money: "Money",
  spending: "Spending",
  credit: "Credit",
  wealth: "Wealth",
  reports: "Reports",
  settings: "Settings",
};

const pageLabels: Record<string, string> = {
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
};

export function Breadcrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const section = segments[0];
  const page = segments[1];

  const sectionLabel = sectionLabels[section];
  const pageLabel = page ? pageLabels[page] : undefined;

  if (!sectionLabel) return null;

  return (
    <nav className={cn("flex items-center gap-1 text-sm", className)}>
      <Link
        href={`/${section}`}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        {sectionLabel}
      </Link>
      {pageLabel && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
          <span className="font-medium text-foreground">{pageLabel}</span>
        </>
      )}
    </nav>
  );
}
