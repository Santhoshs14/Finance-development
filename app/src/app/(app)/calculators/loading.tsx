"use client";

import { SkeletonCard } from "@/components/SkeletonLoader";

export default function CalculatorsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <SkeletonCard lines={2} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
    </div>
  );
}
