"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import InstallPrompt from "@/components/InstallPrompt";
import CommandPalette, { openCommandPalette } from "@/components/CommandPalette";
import NotificationCenter from "@/components/NotificationCenter";
import { MoreSheet } from "@/components/nav/MoreSheet";
import { getRouteTitle, hasOwnPageTitle } from "@/components/nav/nav-config";
import { useAuth } from "@/providers/AuthProvider";
import { useVirtualKeyboard } from "@/hooks/useVirtualKeyboard";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  Breadcrumb,
} from "@/components/ui";
import {
  User,
  Settings,
  LogOut,
  Search,
} from "lucide-react";

const SIDEBAR_STORAGE_KEY = "sidebar-collapsed";

function initialSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
  if (stored !== null) return stored === "1";
  // Icon rail by default on iPad-portrait and small-laptop widths
  return window.matchMedia("(max-width: 1023px)").matches;
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed);
  const [scrolled, setScrolled] = useState(false);
  const { open: keyboardOpen } = useVirtualKeyboard();
  const { scrollY } = useScroll();
  const inlineTitleOpacity = useTransform(scrollY, [24, 56], [0, 1]);

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 4));

  const title = getRouteTitle(pathname);
  const showLargeTitle = !hasOwnPageTitle(pathname);
  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleCollapsedChange = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  };

  const handleLogout = () => {
    signOut();
    router.push("/login");
  };

  return (
    <div
      className="min-h-dvh bg-background"
      style={{ "--sidebar-w": sidebarCollapsed ? "64px" : "232px" } as React.CSSProperties}
    >
      <CommandPalette />
      <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={handleCollapsedChange} />

      <div className="pl-[var(--safe-left)] pr-[var(--safe-right)] transition-[padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:pl-[calc(var(--sidebar-w)_+_max(12px,var(--safe-left))_+_12px)]">
        {/* Top bar: transparent at rest, Liquid Glass once content scrolls under it */}
        <header
          className={cn(
            "sticky top-0 z-40 pt-[var(--safe-top)] transition-[background-color,box-shadow] duration-300",
            scrolled ? "glass-bar" : "bg-transparent"
          )}
        >
          <div className="relative mx-auto flex h-12 w-full max-w-[1400px] items-center gap-1 px-3 sm:px-6 md:h-14 md:gap-2 lg:px-8">
            {/* iOS-style inline title that fades in once the large title scrolls away */}
            <motion.div
              aria-hidden
              style={{ opacity: inlineTitleOpacity }}
              className="pointer-events-none absolute inset-y-0 left-24 right-24 flex items-center justify-center md:hidden"
            >
              <span className="truncate text-headline text-foreground">{title}</span>
            </motion.div>

            <div className="hidden min-w-0 md:block">
              {pathname === "/" ? (
                <h1 className="text-sm font-semibold text-foreground">Home</h1>
              ) : (
                <Breadcrumb />
              )}
            </div>

            <div className="flex-1" />

            <button
              type="button"
              onClick={openCommandPalette}
              aria-label="Open search (⌘K)"
              className="hidden h-9 cursor-pointer items-center gap-2 rounded-full bg-foreground/[0.05] pl-3.5 pr-2 text-[13px] text-muted-foreground transition-colors hover:bg-foreground/[0.08] md:flex"
            >
              <Search className="size-4" />
              <span className="pr-6">Search</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center rounded-md bg-background/80 px-1.5 font-sans text-[11px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </button>

            <NotificationCenter />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="grid size-11 cursor-pointer place-items-center rounded-full md:size-10"
                  aria-label="User menu"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-brand to-accent text-xs font-semibold text-white">
                    {initials}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm text-foreground">{displayName}</span>
                    <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2">
                  <User className="w-4 h-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2">
                  <Settings className="w-4 h-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="gap-2 text-danger focus:text-danger">
                  <LogOut className="w-4 h-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 pb-[calc(var(--safe-bottom)_+_var(--tabbar-h)_+_32px)] pt-1 sm:px-6 md:pb-10 md:pt-4 lg:px-8">
          {showLargeTitle && (
            <h1 className="mb-4 text-large-title text-foreground md:hidden">{title}</h1>
          )}
          {children}
        </main>
      </div>

      <BottomNav
        onMoreClick={() => setMoreOpen(true)}
        onSearchClick={openCommandPalette}
        moreOpen={moreOpen}
        keyboardOpen={keyboardOpen}
      />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
      <InstallPrompt />
    </div>
  );
}
