"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export default memo(function ChartCard({ title, subtitle, children, className = "", action }: ChartCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/50 bg-card p-4 shadow-elev-1 sm:p-5 dark:border-white/[0.06]",
        className
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground md:text-sm">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
});
