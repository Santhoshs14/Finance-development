"use client";

import { memo } from "react";
import { useTheme } from "@/providers/ThemeProvider";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export default memo(function ChartCard({ title, subtitle, children, className = "", action }: ChartCardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div
      className={`rounded-2xl p-5 premium-shadow ${className}`}
      style={{
        background: isDark ? "rgba(17,24,39,0.8)" : "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px) saturate(1.4)",
        border: `1px solid ${isDark ? "rgba(31,41,55,0.6)" : "rgba(229,231,235,0.8)"}`,
      }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold tracking-tight" style={{ color: isDark ? "#f3f4f6" : "#111827" }}>{title}</h3>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: isDark ? "#6b7280" : "#9ca3af" }}>{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
});
