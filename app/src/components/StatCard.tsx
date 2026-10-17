"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import CountUp from "react-countup";
import { cn } from "@/lib/utils";

const TONES: Record<string, { tile: string; icon: string }> = {
  primary: { tile: "bg-brand/12", icon: "text-brand" },
  accent: { tile: "bg-accent/15", icon: "text-accent" },
  danger: { tile: "bg-danger/12", icon: "text-danger" },
  warning: { tile: "bg-warning/15", icon: "text-warning" },
  success: { tile: "bg-success/12", icon: "text-success" },
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
  const tone = TONES[color] ?? TONES.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.32, 0.72, 0, 1] }}
      className="lift-hover relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 shadow-elev-1 sm:p-5 dark:border-white/[0.06]"
    >
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1.5 truncate text-footnote font-medium text-muted-foreground">{title}</p>
          <h3 className="font-rounded text-title2 tabular-nums text-foreground sm:text-[26px]">
            {prefix}
            <CountUp end={typeof value === "number" ? value : 0} duration={1.8} separator="," decimals={value % 1 !== 0 ? 2 : 0} />
            {suffix}
          </h3>
          {trend !== undefined && (
            <div
              className={cn(
                "mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
                trend >= 0 ? "bg-success/12 text-success" : "bg-danger/12 text-danger"
              )}
            >
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
              {trendLabel && <span className="ml-1 font-normal opacity-80">{trendLabel}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone.tile)}>
            <Icon className={cn("size-5", tone.icon)} />
          </div>
        )}
      </div>
    </motion.div>
  );
});
