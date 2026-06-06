"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import InstallPrompt from "@/components/InstallPrompt";
import CommandPalette from "@/components/CommandPalette";
import NotificationCenter from "@/components/NotificationCenter";
import { useAuth } from "@/providers/AuthProvider";
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
  Menu,
  User,
  Settings,
  LogOut,
  Search,
} from "lucide-react";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  const sidebarWidth = isMobile ? 0 : sidebarCollapsed ? 56 : 220;

  const handleLogout = () => {
    signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <CommandPalette />
      <Sidebar
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onCollapsedChange={(v) => setSidebarCollapsed(v)}
      />

      <motion.div
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-40 flex items-center h-14 px-4 sm:px-6 gap-4 border-b border-border/50 bg-background/70 backdrop-blur-2xl backdrop-saturate-150">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb */}
          {pathname === "/" ? (
            <h1 className="text-sm font-semibold text-foreground hidden sm:block">Home</h1>
          ) : (
            <Breadcrumb className="hidden sm:flex" />
          )}

          <div className="flex-1" />

          {/* Search shortcut hint */}
          <button
            className="hidden md:flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-muted/50 text-xs text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Open search (Ctrl+K)"
            onClick={() => {
              document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
            }}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search...</span>
            <kbd className="ml-1.5 pointer-events-none inline-flex h-5 select-none items-center rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          {/* Notifications */}
          <NotificationCenter />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-0.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="User menu">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs bg-gradient-to-br from-brand to-accent">
                  {initials}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{displayName}</span>
                  <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2 text-sm">
                <User className="w-4 h-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2 text-sm">
                <Settings className="w-4 h-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="gap-2 text-sm text-danger focus:text-danger">
                <LogOut className="w-4 h-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 pb-20 md:pb-6">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </main>
      </motion.div>

      {/* Mobile bottom navigation */}
      <BottomNav onMoreClick={() => setMobileMenuOpen(true)} />
      <InstallPrompt />
    </div>
  );
}
