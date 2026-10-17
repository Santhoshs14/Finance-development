"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_LABELS, SECTION_LABELS, SECTION_ROOTS } from "@/components/nav/nav-config";

export function Breadcrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const section = segments[0];
  const page = segments[1];

  const sectionLabel = SECTION_LABELS[section];
  const pageLabel = page ? PAGE_LABELS[page] : undefined;

  if (!sectionLabel) return null;

  return (
    <nav className={cn("flex items-center gap-1 text-sm", className)}>
      <Link
        href={SECTION_ROOTS[section] ?? `/${section}`}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        {sectionLabel}
      </Link>
      {pageLabel && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
          <span className="font-medium text-foreground">{pageLabel}</span>
        </>
      )}
    </nav>
  );
}
