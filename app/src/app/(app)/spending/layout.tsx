"use client";

import { SectionTabs } from "@/components/ui";
import { PieChart, Tags, BarChart3 } from "lucide-react";

const tabs = [
  { label: "Budgets", path: "/spending/budgets", icon: PieChart },
  { label: "Categories", path: "/spending/categories", icon: Tags },
  { label: "Analytics", path: "/spending/analytics", icon: BarChart3 },
];

export default function SpendingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SectionTabs tabs={tabs} />
      {children}
    </div>
  );
}
