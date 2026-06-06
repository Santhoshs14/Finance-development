"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CategoryDotProps {
  /** Color (hex, hsl, rgb…). */
  color?: string;
  /** Optional emoji/letter to render inside (max 2 chars). */
  label?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  /** Soft glow on the dot. */
  glow?: boolean;
}

const SIZE: Record<NonNullable<CategoryDotProps["size"]>, string> = {
  xs: "h-2 w-2 text-[8px]",
  sm: "h-3 w-3 text-[9px]",
  md: "h-4 w-4 text-[10px]",
  lg: "h-6 w-6 text-xs",
};

/**
 * Small colored dot used to identify categories at a glance. Becomes
 * a tiny pill when a `label` (initial / emoji) is provided.
 */
export function CategoryDot({
  color = "hsl(var(--brand))",
  label,
  size = "sm",
  className,
  glow = false,
}: CategoryDotProps) {
  return (
    <span
      role="presentation"
      aria-hidden
      style={{
        backgroundColor: color,
        boxShadow: glow ? `0 0 12px ${color}88` : undefined,
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-full text-white font-semibold flex-shrink-0",
        SIZE[size],
        className
      )}
    >
      {label?.slice(0, 2)}
    </span>
  );
}

export default CategoryDot;
