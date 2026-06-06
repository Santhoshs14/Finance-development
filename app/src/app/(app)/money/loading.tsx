"use client";

import { SkeletonCard, SkeletonTable } from "@/components/SkeletonLoader";

export default function MoneyLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
      <SkeletonTable rows={6} cols={5} />
    </div>
  );
}
