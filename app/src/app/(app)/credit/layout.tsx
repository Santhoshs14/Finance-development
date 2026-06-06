"use client";

import { SectionTabs } from "@/components/ui";
import {
  CreditCard,
  ArrowLeftRight,
  FileText,
  Gift,
  Calculator,
  Lightbulb,
} from "lucide-react";

const tabs = [
  { label: "Overview", path: "/credit", icon: CreditCard },
  { label: "Transactions", path: "/credit/transactions", icon: ArrowLeftRight },
  { label: "Statements", path: "/credit/statements", icon: FileText },
  { label: "Rewards", path: "/credit/rewards", icon: Gift },
  { label: "EMIs", path: "/credit/emis", icon: Calculator },
  { label: "Insights", path: "/credit/insights", icon: Lightbulb },
];

export default function CreditLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SectionTabs tabs={tabs} />
      {children}
    </div>
  );
}
