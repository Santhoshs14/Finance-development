"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";
import {
  Home,
  Landmark,
  ArrowUpDown,
  ArrowLeftRight,
  CalendarClock,
  Handshake,
  PieChart,
  Tags,
  BarChart3,
  CreditCard,
  FileText,
  Gift,
  Calculator,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Repeat,
  Target,
  LineChart,
  Gem,
  CalendarDays,
  Calendar,
  Heart,
  Shield,
  Settings,
  Sun,
  Moon,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ChevronRight,
  Split,
} from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  id: string;
  label?: string;
  icon?: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    id: "home",
    items: [{ label: "Home", path: "/", icon: Home }],
  },
  {
    id: "money",
    label: "Money",
    icon: Landmark,
    items: [
      { label: "Accounts", path: "/money/accounts", icon: Landmark },
      { label: "Cash Flow", path: "/money/cash-flow", icon: ArrowUpDown },
      { label: "Transactions", path: "/money/transactions", icon: ArrowLeftRight },
      { label: "Recurring", path: "/money/recurring", icon: Repeat },
      { label: "Bills & Subs", path: "/money/bills", icon: CalendarClock },
      { label: "Debt Strategy", path: "/money/debt-strategy", icon: TrendingDown },
      { label: "Lending", path: "/money/lending", icon: Handshake },
      { label: "Splits", path: "/money/splits", icon: Split },
    ],
  },
  {
    id: "spending",
    label: "Spending",
    icon: PieChart,
    items: [
      { label: "Budgets", path: "/spending/budgets", icon: PieChart },
      { label: "Categories", path: "/spending/categories", icon: Tags },
      { label: "Analytics", path: "/spending/analytics", icon: BarChart3 },
    ],
  },
  {
    id: "credit",
    label: "Credit",
    icon: CreditCard,
    items: [
      { label: "Overview", path: "/credit", icon: CreditCard },
      { label: "Transactions", path: "/credit/transactions", icon: ArrowLeftRight },
      { label: "Statements", path: "/credit/statements", icon: FileText },
      { label: "Rewards", path: "/credit/rewards", icon: Gift },
      { label: "EMIs", path: "/credit/emis", icon: Calculator },
      { label: "Insights", path: "/credit/insights", icon: Lightbulb },
    ],
  },
  {
    id: "wealth",
    label: "Wealth",
    icon: TrendingUp,
    items: [
      { label: "Portfolio", path: "/wealth/portfolio", icon: TrendingUp },
      { label: "Gold", path: "/wealth/gold", icon: Gem },
      { label: "SIPs", path: "/wealth/sips", icon: Repeat },
      { label: "Goals", path: "/wealth/goals", icon: Target },
      { label: "Net Worth", path: "/wealth/net-worth", icon: LineChart },
      { label: "Retirement", path: "/wealth/retirement", icon: Calculator },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: CalendarDays,
    items: [
      { label: "Monthly", path: "/reports/monthly", icon: CalendarDays },
      { label: "Yearly", path: "/reports/yearly", icon: Calendar },
      { label: "Health", path: "/reports/health", icon: Heart },
      { label: "Tax", path: "/reports/tax", icon: Shield },
    ],
  },
];

interface SidebarProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
  onCollapsedChange?: (v: boolean) => void;
}

export default function Sidebar({ mobileMenuOpen, setMobileMenuOpen, onCollapsedChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const { resolvedTheme, setTheme } = useTheme();
  const { signOut } = useAuth();
  const pathname = usePathname();
  const isDark = resolvedTheme === "dark";

  const handleSetCollapsed = (val: boolean) => {
    setCollapsed(val);
    onCollapsedChange?.(val);
  };

  const handleNavClick = () => {
    if (mobileMenuOpen) setMobileMenuOpen(false);
  };

  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  // Determine which section is active based on pathname
  const getActiveSection = () => {
    if (pathname === "/") return "home";
    const firstSegment = pathname.split("/").filter(Boolean)[0];
    return sections.find((s) => s.items.some((i) => i.path.startsWith(`/${firstSegment}`)))?.id || "";
  };

  const activeSection = getActiveSection();

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

  const isSectionExpanded = (sectionId: string) => {
    return expandedSections.has(sectionId) || activeSection === sectionId;
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        animate={{ width: collapsed ? 56 : 220 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          "fixed top-0 left-0 h-screen z-50 flex flex-col overflow-hidden border-r border-sidebar-border bg-sidebar transition-transform duration-300 ease-in-out",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-3 h-14 border-b border-sidebar-border flex-shrink-0">
          <Link href="/" onClick={handleNavClick} className="flex items-center gap-2.5">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg brand-gradient shadow-md premium-glow">
              <svg width="16" height="16" viewBox="0 0 512 512" fill="none">
                <path d="M128 160 L192 352 L256 220 L320 352 L384 160" stroke="white" strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <circle cx="256" cy="380" r="20" fill="#f59e0b" />
              </svg>
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -4 }}
                  transition={{ duration: 0.15 }}
                  className="font-bold text-[15px] tracking-tight text-foreground"
                >
                  Wealth<span className="brand-gradient-text">Flow</span>
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
            className="md:hidden p-1 text-muted-foreground hover:text-foreground rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 pt-3 overflow-y-auto overflow-x-hidden">
          {sections.map((section) => {
            if (section.id === "home") {
              // Home is always visible, not in a collapsible group
              const item = section.items[0];
              const isActive = pathname === item.path;
              return (
                <div key={section.id} className="mb-2">
                  <Link
                    href={item.path}
                    onClick={handleNavClick}
                    className={cn(
                      "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      collapsed && "justify-center px-2",
                      isActive
                        ? "bg-brand/10 text-brand"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-[18px] w-[18px] flex-shrink-0", isActive && "text-brand")} />
                    {!collapsed && <span>{item.label}</span>}
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-brand"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </Link>
                </div>
              );
            }

            const isExpanded = isSectionExpanded(section.id);
            const isSectionActive = activeSection === section.id;
            const SectionIcon = section.icon!;

            return (
              <div key={section.id} className="mb-1">
                {/* Section header */}
                {collapsed ? (
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-md px-2 py-2 mb-0.5 cursor-pointer transition-colors",
                      isSectionActive
                        ? "text-brand"
                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                    )}
                    title={section.label}
                    onClick={() => handleSetCollapsed(false)}
                  >
                    <SectionIcon className="h-[18px] w-[18px]" />
                  </div>
                ) : (
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={cn(
                      "flex items-center gap-2 w-full rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                      isSectionActive
                        ? "text-brand"
                        : "text-section-header hover:text-foreground"
                    )}
                  >
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 transition-transform duration-200",
                        isExpanded && "rotate-90"
                      )}
                    />
                    <span>{section.label}</span>
                  </button>
                )}

                {/* Section items */}
                {!collapsed && (
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-0.5 pl-2 mt-0.5">
                          {section.items.map((item) => {
                            const isActive = pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path + "/"));

                            return (
                              <Link
                                key={item.path}
                                href={item.path}
                                onClick={handleNavClick}
                                className={cn(
                                  "relative flex items-center gap-3 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                                  isActive
                                    ? "bg-brand/10 text-brand"
                                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                                )}
                              >
                                <item.icon className={cn("h-4 w-4 flex-shrink-0", isActive && "text-brand")} />
                                <span>{item.label}</span>
                                {isActive && (
                                  <motion.div
                                    layoutId="sidebar-active"
                                    className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r-full bg-brand"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                  />
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-2 border-t border-sidebar-border space-y-0.5 flex-shrink-0">
          <Link
            href="/settings"
            onClick={handleNavClick}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              collapsed && "justify-center px-2",
              pathname === "/settings"
                ? "bg-brand/10 text-brand"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            )}
          >
            <Settings className="h-[18px] w-[18px]" />
            {!collapsed && <span>Settings</span>}
          </Link>

          <button
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium w-full transition-colors text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              collapsed && "justify-center px-2"
            )}
          >
            {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            {!collapsed && <span>{isDark ? "Light" : "Dark"}</span>}
          </button>

          <button
            onClick={() => signOut()}
            aria-label="Sign out"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium w-full transition-colors text-danger hover:bg-danger/10",
              collapsed && "justify-center px-2"
            )}
          >
            <LogOut className="h-[18px] w-[18px]" />
            {!collapsed && <span>Logout</span>}
          </button>

          <button
            onClick={() => handleSetCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "hidden md:flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium w-full transition-colors text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              collapsed && "justify-center px-2"
            )}
          >
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </motion.aside>
    </>
  );
}
