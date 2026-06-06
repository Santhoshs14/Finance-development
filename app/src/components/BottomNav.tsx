"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Wallet, ShoppingCart, TrendingUp, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/money/transactions", icon: Wallet, label: "Money" },
  { href: "/spending/budgets", icon: ShoppingCart, label: "Spend" },
  { href: "/wealth/portfolio", icon: TrendingUp, label: "Wealth" },
];

interface BottomNavProps {
  onMoreClick: () => void;
}

export default function BottomNav({ onMoreClick }: BottomNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href.split("/").slice(0, 2).join("/"));
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/70 backdrop-blur-2xl backdrop-saturate-150 pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-14 h-full text-[10px] font-medium transition-colors",
                active ? "text-brand" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", active && "text-brand")} />
              {label}
            </Link>
          );
        })}
        <button
          onClick={onMoreClick}
          className="flex flex-col items-center justify-center gap-0.5 w-14 h-full text-[10px] font-medium text-muted-foreground"
        >
          <Menu className="w-5 h-5" />
          More
        </button>
      </div>
    </nav>
  );
}
