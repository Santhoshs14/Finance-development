"use client";

import { SkeletonCard } from "@/components/SkeletonLoader";

export default function AppLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="h-9 w-32 rounded-lg bg-muted animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    </div>
  );
}
