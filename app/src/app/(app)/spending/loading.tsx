"use client";

import { SkeletonCard } from "@/components/SkeletonLoader";

export default function SpendingLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={6} />
      </div>
    </div>
  );
}
