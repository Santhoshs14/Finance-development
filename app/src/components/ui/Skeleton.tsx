import * as React from "react";
import { cn } from "@/lib/utils";

type SkeletonVariant = "text" | "card" | "row" | "chart" | "avatar" | "circle";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
}

const VARIANT: Record<SkeletonVariant, string> = {
  text: "h-3 w-full rounded-md",
  card: "h-32 w-full rounded-2xl",
  row: "h-12 w-full rounded-lg",
  chart: "h-56 w-full rounded-2xl",
  avatar: "h-9 w-9 rounded-full",
  circle: "h-12 w-12 rounded-full",
};

function Skeleton({ className, variant = "text", ...props }: SkeletonProps) {
  return (
    <div
      className={cn("bg-muted animate-shimmer", VARIANT[variant], className)}
      {...props}
    />
  );
}

/** Compose multiple skeleton rows. */
function SkeletonStack({
  rows = 3,
  className,
  variant = "text",
}: {
  rows?: number;
  className?: string;
  variant?: SkeletonVariant;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant={variant} />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonStack };
