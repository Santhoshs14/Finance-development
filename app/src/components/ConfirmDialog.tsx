"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: "danger" | "warning" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmColor = "danger",
  onConfirm,
  onCancel,
  icon: CustomIcon,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape key
  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;

    const focusable = el.querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])');
    focusable[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { onCancel(); return; }
      if (e.key !== "Tab" || !focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const Icon = CustomIcon || AlertTriangle;
  const iconBg = confirmColor === "danger" ? "bg-danger/12" : confirmColor === "warning" ? "bg-warning/12" : "bg-brand/12";
  const iconColor = confirmColor === "danger" ? "text-danger" : confirmColor === "warning" ? "text-warning" : "text-brand";
  const actionClass = "h-12 cursor-pointer text-[17px] transition-colors active:bg-foreground/[0.08] md:h-11 md:text-[15px] [@media(hover:hover)]:hover:bg-foreground/[0.04]";

  // iOS alert: centered glass card with full-width, hairline-separated actions
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/35 p-6"
      onClick={onCancel}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={message ? "confirm-dialog-message" : undefined}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="glass-sheet w-full max-w-[300px] animate-scale-in overflow-hidden rounded-[22px] text-center md:max-w-[340px]"
      >
        <div className="px-5 pb-4 pt-5">
          <div className={cn("mx-auto mb-3 grid size-11 place-items-center rounded-full", iconBg)}>
            <Icon className={cn("size-5", iconColor)} />
          </div>
          <h3 id="confirm-dialog-title" className="text-headline text-foreground">{title}</h3>
          {message && (
            <p id="confirm-dialog-message" className="mt-1 text-footnote text-muted-foreground">
              {message}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 border-t border-border/70">
          <button type="button" onClick={onCancel} className={cn(actionClass, "text-brand")}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(actionClass, "border-l border-border/70 font-semibold", confirmColor === "danger" ? "text-danger" : "text-brand")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
