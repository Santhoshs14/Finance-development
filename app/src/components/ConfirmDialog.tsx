"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
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
  const iconBg = confirmColor === "danger" ? "bg-danger/10" : confirmColor === "warning" ? "bg-warning/10" : "bg-brand/10";
  const iconColor = confirmColor === "danger" ? "text-danger" : confirmColor === "warning" ? "text-warning" : "text-brand";
  const btnVariant = confirmColor === "danger" ? "danger" as const : "default" as const;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div ref={dialogRef} onClick={(e) => e.stopPropagation()} className="w-full max-w-[400px] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        <div className="p-7 text-center">
          <div className={cn("w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center", iconBg)}>
            <Icon className={cn("w-6 h-6", iconColor)} />
          </div>
          <h3 id="confirm-dialog-title" className="text-[17px] font-bold text-foreground mb-2">{title}</h3>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <Button variant="secondary" onClick={onCancel} className="flex-1">{cancelLabel}</Button>
          <Button variant={btnVariant} onClick={onConfirm} className="flex-1">{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
