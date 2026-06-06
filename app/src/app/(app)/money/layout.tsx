"use client";

import { SectionTabs } from "@/components/ui";
import {
  Landmark,
  ArrowUpDown,
  ArrowLeftRight,
  CalendarClock,
  Repeat,
  Handshake,
  TrendingDown,
} from "lucide-react";

const tabs = [
  { label: "Accounts", path: "/money/accounts", icon: Landmark },
  { label: "Cash Flow", path: "/money/cash-flow", icon: ArrowUpDown },
  { label: "Transactions", path: "/money/transactions", icon: ArrowLeftRight },
  { label: "Recurring", path: "/money/recurring", icon: Repeat },
  { label: "Bills & Subs", path: "/money/bills", icon: CalendarClock },
  { label: "Debt Strategy", path: "/money/debt-strategy", icon: TrendingDown },
  { label: "Lending", path: "/money/lending", icon: Handshake },
];

export default function MoneyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SectionTabs tabs={tabs} />
      {children}
    </div>
  );
}
