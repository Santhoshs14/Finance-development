"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import CountUp from "react-countup";
import { useTheme } from "@/providers/ThemeProvider";

const glowColors: Record<string, string> = {
  primary: "rgba(0,128,255,0.15)",
  accent: "rgba(245,158,11,0.15)",
  danger: "rgba(239,68,68,0.15)",
  warning: "rgba(251,191,36,0.15)",
  success: "rgba(34,197,94,0.15)",
};

const iconColors: Record<string, string> = {
  primary: "#0080ff",
  accent: "#f59e0b",
  danger: "#ef4444",
  warning: "#f59e0b",
  success: "#22c55e",
};

interface StatCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  trend?: number;
  trendLabel?: string;
  color?: string;
  delay?: number;
}

export default memo(function StatCard({ title, value, prefix = "₹", suffix = "", icon: Icon, trend, trendLabel, color = "primary", delay = 0 }: StatCardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const glow = glowColors[color] || glowColors.primary;
  const iconColor = iconColors[color] || iconColors.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      whileHover={{ y: -3, scale: 1.01 }}
      className="relative overflow-hidden rounded-2xl p-4 sm:p-6 cursor-default premium-shadow"
      style={{
        background: isDark ? "rgba(17,24,39,0.8)" : "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px) saturate(1.4)",
        border: `1px solid ${isDark ? "rgba(31,41,55,0.6)" : "rgba(229,231,235,0.8)"}`,
      }}
    >
      {/* Subtle gradient orb */}
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none opacity-60" style={{ background: glow, filter: "blur(24px)" }} />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium tracking-wide uppercase mb-2" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>{title}</p>
          <h3 className="text-[26px] font-extrabold tracking-tight" style={{ color: isDark ? "#f3f4f6" : "#111827" }}>
            {prefix}
            <CountUp end={typeof value === "number" ? value : 0} duration={1.8} separator="," decimals={value % 1 !== 0 ? 2 : 0} />
            {suffix}
          </h3>
          {trend !== undefined && (
            <div
              className="inline-flex items-center gap-1 mt-2.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: trend >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: trend >= 0 ? "#22c55e" : "#ef4444" }}
            >
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
              {trendLabel && <span className="ml-1 font-normal opacity-80">{trendLabel}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: glow }}>
            <Icon className="w-5 h-5" style={{ color: iconColor }} />
          </div>
        )}
      </div>
    </motion.div>
  );
});
