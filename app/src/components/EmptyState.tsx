"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  emoji?: string;
  compact?: boolean;
}

export default function EmptyState({
  icon: Icon,
  title = "Nothing here yet",
  description = "",
  actionLabel,
  onAction,
  emoji,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-8 px-5" : "py-12 px-6")}>
      {Icon && (
        <div className={cn("flex items-center justify-center mb-4 rounded-2xl bg-muted", compact ? "w-12 h-12" : "w-16 h-16")}>
          <Icon className={cn("text-muted-foreground/60", compact ? "w-5 h-5" : "w-7 h-7")} />
        </div>
      )}
      {emoji && !Icon && (
        <div className="mb-4" style={{ fontSize: compact ? 32 : 48, lineHeight: 1 }}>{emoji}</div>
      )}
      <h3 className="font-bold text-base text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-xs">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" className="mt-4">{actionLabel}</Button>
      )}
    </div>
  );
}
