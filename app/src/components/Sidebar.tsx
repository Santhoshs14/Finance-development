"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";
import { LIQUID_SPRING } from "@/lib/motion";
import { NAV_SECTIONS, findActiveNavPath, type NavItem } from "@/components/nav/nav-config";
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
} from "lucide-react";

const SETTINGS_ITEM: NavItem = { label: "Settings", path: "/settings", icon: Settings };

const THEME_META = {
  system: { label: "Auto", icon: Monitor, next: "light" },
  light: { label: "Light", icon: Sun, next: "dark" },
  dark: { label: "Dark", icon: Moon, next: "system" },
} as const;

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

function SidebarLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const reduceMotion = useReducedMotion();
  return (
    <Link
      href={item.path}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-colors",
        collapsed && "justify-center px-0",
        active ? "text-brand" : "text-foreground/75 hover:bg-foreground/[0.05] hover:text-foreground"
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-pill"
          className="absolute inset-0 rounded-xl bg-brand/12"
          transition={reduceMotion ? { duration: 0 } : { type: "spring", ...LIQUID_SPRING }}
        />
      )}
      <item.icon className="relative size-[18px] shrink-0" />
      {!collapsed && <span className="relative truncate">{item.label}</span>}
    </Link>
  );
}

/** Desktop navigation: a floating Liquid Glass panel (mobile uses the tab bar + More sheet). */
export default function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();
  const pathname = usePathname();

  const activePath = findActiveNavPath(pathname, [SETTINGS_ITEM.path]);
  const activeSection = NAV_SECTIONS.find((s) => s.items.some((i) => i.path === activePath))?.id ?? "";
  const themeMeta = THEME_META[theme];
  const ThemeIcon = themeMeta.icon;

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const isSectionExpanded = (sectionId: string) => expandedSections.has(sectionId) || activeSection === sectionId;

  const actionClass = cn(
    "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-colors",
    collapsed && "justify-center px-0"
  );

  return (
    <aside
      aria-label="Main navigation"
      className="glass-chrome fixed bottom-3 left-[max(12px,var(--safe-left))] top-3 z-50 hidden flex-col overflow-hidden rounded-[22px] transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:flex"
      style={{ width: "var(--sidebar-w)" }}
    >
      {/* Logo */}
      <div className={cn("flex h-14 shrink-0 items-center px-3", collapsed && "justify-center px-0")}>
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-[10px] brand-gradient shadow-elev-2">
            <svg width="16" height="16" viewBox="0 0 512 512" fill="none" aria-hidden>
              <path d="M128 160 L192 352 L256 220 L320 352 L384 160" stroke="white" strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <circle cx="256" cy="380" r="20" fill="#f59e0b" />
            </svg>
          </span>
          {!collapsed && (
            <span className="truncate text-[15px] font-bold tracking-tight text-foreground">
              Wealth<span className="brand-gradient-text">Flow</span>
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="scrollbar-none flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
        {NAV_SECTIONS.map((section) => {
          if (!section.label) {
            const item = section.items[0];
            return (
              <div key={section.id} className="mb-1">
                <SidebarLink item={item} active={item.path === activePath} collapsed={collapsed} />
              </div>
            );
          }

          const isExpanded = isSectionExpanded(section.id);
          const isSectionActive = activeSection === section.id;
          const SectionIcon = section.icon!;

          if (collapsed) {
            return (
              <button
                key={section.id}
                type="button"
                title={section.label}
                aria-label={`Expand ${section.label}`}
                onClick={() => onCollapsedChange(false)}
                className={cn(
                  "mb-1 flex w-full cursor-pointer items-center justify-center rounded-xl py-2 transition-colors",
                  isSectionActive ? "text-brand" : "text-foreground/70 hover:bg-foreground/[0.05] hover:text-foreground"
                )}
              >
                <SectionIcon className="size-[18px]" />
              </button>
            );
          }

          return (
            <div key={section.id} className="mb-1">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                aria-expanded={isExpanded}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-3 pb-1 pt-3 text-[11px] font-semibold transition-colors",
                  isSectionActive ? "text-brand" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{section.label}</span>
                <ChevronRight
                  className={cn("size-3 transition-transform duration-200", isExpanded && "rotate-90")}
                  strokeWidth={2.5}
                />
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-0.5 pt-0.5">
                      {section.items.map((item) => (
                        <SidebarLink key={item.path} item={item} active={item.path === activePath} collapsed={false} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="shrink-0 space-y-0.5 border-t border-border/50 p-2">
        <SidebarLink item={SETTINGS_ITEM} active={activePath === SETTINGS_ITEM.path} collapsed={collapsed} />

        <button
          type="button"
          onClick={() => setTheme(themeMeta.next)}
          title={collapsed ? `Appearance: ${themeMeta.label}` : undefined}
          aria-label={`Appearance: ${themeMeta.label}. Switch appearance`}
          className={cn(actionClass, "text-foreground/75 hover:bg-foreground/[0.05] hover:text-foreground")}
        >
          <ThemeIcon className="size-[18px] shrink-0" />
          {!collapsed && <span>Appearance: {themeMeta.label}</span>}
        </button>

        <button
          type="button"
          onClick={() => signOut()}
          title={collapsed ? "Logout" : undefined}
          aria-label="Sign out"
          className={cn(actionClass, "text-danger hover:bg-danger/10")}
        >
          <LogOut className="size-[18px] shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>

        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(actionClass, "text-foreground/60 hover:bg-foreground/[0.05] hover:text-foreground")}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px] shrink-0" /> : <PanelLeftClose className="size-[18px] shrink-0" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
