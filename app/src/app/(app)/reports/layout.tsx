"use client";

import { SectionTabs } from "@/components/ui";
import { CalendarDays, Calendar, Heart } from "lucide-react";

const tabs = [
  { label: "Monthly Review", path: "/reports/monthly", icon: CalendarDays },
  { label: "Yearly Review", path: "/reports/yearly", icon: Calendar },
  { label: "Financial Health", path: "/reports/health", icon: Heart },
];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SectionTabs tabs={tabs} />
      {children}
    </div>
  );
}
