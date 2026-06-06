"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface GradientHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Gradient preset — defaults to hero (multi-stop brand → purple). */
  tone?: "hero" | "brand" | "success" | "danger" | "warning" | "purple";
  /** Show a subtle starfield/sparkle pattern overlay. */
  pattern?: boolean;
  /** When `true`, adds a brand glow halo. */
  glow?: boolean;
}

const TONE_CLASS: Record<NonNullable<GradientHeroProps["tone"]>, string> = {
  hero: "hero-gradient",
  brand: "brand-gradient",
  success: "success-gradient",
  danger: "danger-gradient",
  warning: "warning-gradient",
  purple: "purple-gradient",
};

const GLOW_CLASS: Record<NonNullable<GradientHeroProps["tone"]>, string> = {
  hero: "glow-brand",
  brand: "glow-brand",
  success: "glow-success",
  danger: "glow-danger",
  warning: "glow-warning",
  purple: "glow-brand",
};

/**
 * Full-bleed gradient hero card. Used at the top of Dashboard, Wealth,
 * Spending hubs to give pages a strong visual anchor.
 */
export function GradientHero({
  tone = "hero",
  pattern = true,
  glow = true,
  className,
  children,
  ...props
}: GradientHeroProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl text-white elev-4",
        TONE_CLASS[tone],
        glow && GLOW_CLASS[tone],
        className
      )}
      {...props}
    >
      {pattern && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18) 0px, transparent 40%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.12) 0px, transparent 50%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full blur-3xl"
            style={{ background: "rgba(255,255,255,0.15)" }}
          />
        </>
      )}
      <div className="relative z-10 p-6 md:p-8">{children}</div>
    </div>
  );
}

export default GradientHero;
