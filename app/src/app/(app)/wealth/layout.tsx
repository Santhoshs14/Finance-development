"use client";

import { SectionTabs } from "@/components/ui";
import { TrendingUp, Repeat, Target, LineChart, Gem, Calculator } from "lucide-react";

const tabs = [
  { label: "Portfolio", path: "/wealth/portfolio", icon: TrendingUp },
  { label: "Gold", path: "/wealth/gold", icon: Gem },
  { label: "SIPs", path: "/wealth/sips", icon: Repeat },
  { label: "Goals", path: "/wealth/goals", icon: Target },
  { label: "Net Worth", path: "/wealth/net-worth", icon: LineChart },
  { label: "Retirement", path: "/wealth/retirement", icon: Calculator },
];

export default function WealthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SectionTabs tabs={tabs} />
      {children}
    </div>
  );
}
