"use client";

import { SkeletonCard } from "@/components/SkeletonLoader";

export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-3xl">
      <div className="h-8 w-32 rounded-lg bg-muted animate-pulse" />
      <SkeletonCard lines={4} />
      <SkeletonCard lines={4} />
    </div>
  );
}
