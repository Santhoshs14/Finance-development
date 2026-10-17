"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LIQUID_SPRING } from "@/lib/motion";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  "aria-label": string;
  size?: "sm" | "md";
  className?: string;
}

/** iOS segmented control with a sliding selection thumb. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  const id = React.useId();
  const reduceMotion = useReducedMotion();

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("flex rounded-full bg-muted p-0.5", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex-1 cursor-pointer rounded-full px-3 font-medium transition-colors",
              size === "sm" ? "h-7 text-footnote" : "h-8 text-subhead md:text-sm",
              selected ? "text-foreground" : "text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
            )}
          >
            {selected && (
              <motion.span
                layoutId={`segment-${id}`}
                className="absolute inset-0 rounded-full bg-card shadow-elev-2 dark:bg-white/20"
                transition={reduceMotion ? { duration: 0 } : { type: "spring", ...LIQUID_SPRING }}
              />
            )}
            <span className="relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
              {Icon && <Icon className="size-4" />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
