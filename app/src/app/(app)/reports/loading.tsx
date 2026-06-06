"use client";

import { SkeletonCard } from "@/components/SkeletonLoader";

export default function ReportsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
      <SkeletonCard lines={8} />
    </div>
  );
}
