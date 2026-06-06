"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";

const pulse = {
  animate: { opacity: [0.4, 0.8, 0.4] },
  transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" as const },
};

function SkeletonBlock({ width = "100%", height = 16, radius = 8 }: { width?: string | number; height?: number; radius?: number }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <motion.div {...pulse} style={{ width, height, borderRadius: radius, background: isDark ? "#1f2937" : "#e5e7eb" }} />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: isDark ? "#111827" : "#ffffff", border: `1px solid ${isDark ? "#1f2937" : "#e5e7eb"}` }}>
      <SkeletonBlock width="40%" height={12} />
      <SkeletonBlock width="60%" height={26} />
      {Array.from({ length: Math.max(0, lines - 2) }).map((_, i) => (
        <SkeletonBlock key={i} width={`${60 + Math.random() * 30}%`} height={12} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: isDark ? "#111827" : "#ffffff", border: `1px solid ${isDark ? "#1f2937" : "#e5e7eb"}` }}>
      <div className="p-4 flex gap-4" style={{ borderBottom: `1px solid ${isDark ? "#1f2937" : "#f3f4f6"}` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBlock key={i} width={i === 0 ? "20%" : "15%"} height={12} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="p-4 flex gap-4" style={{ borderBottom: `1px solid ${isDark ? "#1f2937" : "#f9fafb"}` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBlock key={c} width={`${40 + Math.random() * 40}%`} height={14} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default SkeletonBlock;
