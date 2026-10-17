"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListGroupProps {
  title?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** iOS inset-grouped list section. */
export function ListGroup({ title, footer, children, className }: ListGroupProps) {
  return (
    <section className={cn("space-y-1.5", className)}>
      {title && (
        <h3 className="px-4 text-footnote font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      )}
      <div className="overflow-hidden rounded-2xl bg-card">{children}</div>
      {footer && <p className="px-4 text-footnote text-muted-foreground">{footer}</p>}
    </section>
  );
}

interface ListRowProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Background class for the icon tile, e.g. "bg-chart-3". */
  iconClassName?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  active?: boolean;
  destructive?: boolean;
  centered?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function ListRow({
  title,
  subtitle,
  icon: Icon,
  iconClassName,
  leading,
  trailing,
  chevron = false,
  active = false,
  destructive = false,
  centered = false,
  href,
  onClick,
  className,
}: ListRowProps) {
  const rowClass = cn(
    "group flex w-full items-center gap-3 pl-4 text-left transition-colors active:bg-muted/70 [@media(hover:hover)]:hover:bg-muted/50",
    className
  );

  const content = (
    <>
      {Icon && (
        <span
          aria-hidden
          className={cn("grid size-[30px] shrink-0 place-items-center rounded-[8px] text-white", iconClassName ?? "bg-brand")}
        >
          <Icon className="size-[18px]" strokeWidth={2} />
        </span>
      )}
      {leading}
      <span className="flex min-h-11 min-w-0 flex-1 items-center gap-2 border-b border-border/70 py-2.5 pr-4 group-last:border-b-0">
        <span className={cn("min-w-0 flex-1", centered && "text-center")}>
          <span
            className={cn(
              "block truncate text-body text-foreground",
              active && "font-semibold text-brand",
              destructive && "text-danger"
            )}
          >
            {title}
          </span>
          {subtitle && <span className="block truncate text-subhead text-muted-foreground">{subtitle}</span>}
        </span>
        {trailing}
        {chevron && <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground/60" strokeWidth={2.5} />}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} aria-current={active ? "page" : undefined} className={rowClass}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={rowClass}>
        {content}
      </button>
    );
  }
  return <div className={rowClass}>{content}</div>;
}
