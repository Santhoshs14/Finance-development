"use client";

import { SectionTabs } from "@/components/ui";
import { CalendarDays, Calendar, Heart, Shield } from "lucide-react";

const tabs = [
  { label: "Monthly Review", path: "/reports/monthly", icon: CalendarDays },
  { label: "Yearly Review", path: "/reports/yearly", icon: Calendar },
  { label: "Financial Health", path: "/reports/health", icon: Heart },
  { label: "Tax Optimizer", path: "/reports/tax", icon: Shield },
];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SectionTabs tabs={tabs} />
      {children}
    </div>
  );
}
