"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LIQUID_SPRING } from "@/lib/motion";

export interface SectionTab {
  label: string;
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SectionTabsProps {
  tabs: SectionTab[];
  className?: string;
}

/** iOS-style scope bar: scrolling capsule chips with a sliding selection. */
export function SectionTabs({ tabs, className }: SectionTabsProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const scrollerRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const active = activeRef.current;
    if (!scroller || !active) return;
    // Keep the selected chip in view when the strip overflows on phones
    scroller.scrollLeft = active.offsetLeft - (scroller.clientWidth - active.offsetWidth) / 2;
  }, [pathname]);

  return (
    <div className={cn("-mx-4 sm:mx-0", className)}>
      <nav
        ref={scrollerRef}
        aria-label="Section"
        className="scrollbar-none flex gap-1.5 overflow-x-auto px-4 py-0.5 sm:px-0"
      >
        {tabs.map((tab) => {
          const isActive = pathname === tab.path;
          return (
            <Link
              key={tab.path}
              ref={isActive ? activeRef : undefined}
              href={tab.path}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition-colors md:h-8",
                isActive
                  ? "text-brand-foreground"
                  : "bg-foreground/[0.05] text-foreground/80 hover:bg-foreground/[0.08] hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="section-tab-pill"
                  className="absolute inset-0 rounded-full bg-brand shadow-[var(--glow-brand)]"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", ...LIQUID_SPRING }}
                />
              )}
              {tab.icon && <tab.icon className="relative size-4" />}
              <span className="relative">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
