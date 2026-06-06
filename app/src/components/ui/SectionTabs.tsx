"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SectionTab {
  label: string;
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SectionTabsProps {
  tabs: SectionTab[];
  className?: string;
}

export function SectionTabs({ tabs, className }: SectionTabsProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className={cn("border-b border-border", className)}>
      <nav className="flex gap-1 overflow-x-auto pb-px scrollbar-none">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => router.push(tab.path)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                isActive
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {tab.icon && <tab.icon className="w-4 h-4" />}
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
