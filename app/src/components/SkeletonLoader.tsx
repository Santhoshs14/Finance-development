"use client";

import { motion } from "framer-motion";

const pulse = {
  animate: { opacity: [0.4, 0.8, 0.4] },
  transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" as const },
};

function SkeletonBlock({ width = "100%", height = 16, radius = 8 }: { width?: string | number; height?: number; radius?: number }) {
  return (
    <motion.div {...pulse} className="bg-muted" style={{ width, height, borderRadius: radius }} />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card p-5 dark:border-white/[0.06]">
      <SkeletonBlock width="40%" height={12} />
      <SkeletonBlock width="60%" height={26} />
      {Array.from({ length: Math.max(0, lines - 2) }).map((_, i) => (
        <SkeletonBlock key={i} width={`${60 + Math.random() * 30}%`} height={12} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card dark:border-white/[0.06]">
      <div className="flex gap-4 border-b border-border/60 p-4">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBlock key={i} width={i === 0 ? "20%" : "15%"} height={12} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-border/40 p-4 last:border-b-0">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBlock key={c} width={`${40 + Math.random() * 40}%`} height={14} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default SkeletonBlock;
