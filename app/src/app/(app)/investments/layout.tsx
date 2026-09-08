"use client";

import { SectionTabs } from "@/components/ui";
import {
  LayoutDashboard,
  TrendingUp,
  Gem,
  Landmark,
  Target,
  LineChart,
} from "lucide-react";

const tabs = [
  { label: "Overview", path: "/investments", icon: LayoutDashboard },
  { label: "Mutual Funds", path: "/investments/mutual-funds", icon: TrendingUp },
  { label: "Gold", path: "/investments/gold", icon: Gem },
  { label: "Other", path: "/investments/other", icon: Landmark },
  { label: "Goals", path: "/investments/goals", icon: Target },
  { label: "Net Worth", path: "/investments/net-worth", icon: LineChart },
];

export default function InvestmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <SectionTabs tabs={tabs} />
      {children}
    </div>
  );
}
