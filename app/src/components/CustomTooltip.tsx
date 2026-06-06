"use client";

import { useTheme } from "@/providers/ThemeProvider";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: Record<string, unknown> }>;
  label?: string;
}

export default function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-xl px-3 py-2 shadow-lg text-xs"
      style={{ background: isDark ? "#1e293b" : "#ffffff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}` }}
    >
      {label && <p className="font-semibold mb-1" style={{ color: isDark ? "#f3f4f6" : "#111827" }}>{label}</p>}
      {payload.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
          <span style={{ color: isDark ? "#d1d5db" : "#374151" }}>{item.name}: ₹{(item.value || 0).toLocaleString("en-IN")}</span>
        </div>
      ))}
    </div>
  );
}
