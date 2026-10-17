"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { SHEET_SPRING } from "@/lib/motion";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Keeps the title for screen readers but hides it visually. */
  hideTitle?: boolean;
  /** Pinned below the scrolling body; use `form="id"` on submit buttons. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  size?: "md" | "lg";
}

const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 600;

/**
 * iOS-style sheet: slides up from the bottom with a grabber and drag-to-dismiss
 * on phones, and becomes a centered dialog from the md breakpoint up.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  hideTitle = false,
  footer,
  children,
  className,
  bodyClassName,
  size = "md",
}: SheetProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();

  const variants = isDesktop
    ? { hidden: { opacity: 0, scale: 0.96 }, shown: { opacity: 1, scale: 1 } }
    : { hidden: { y: "100%" }, shown: { y: 0 } };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[100] bg-black/35"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
              />
            </DialogPrimitive.Overlay>
            <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)_+_12px)] bottom-[var(--kb-inset)] z-[100] flex items-end justify-center md:inset-0 md:items-center md:p-6">
              <DialogPrimitive.Content
                asChild
                forceMount
                {...(description ? {} : { "aria-describedby": undefined })}
              >
                <motion.div
                  className={cn(
                    "glass-sheet pointer-events-auto relative flex max-h-full w-full flex-col overflow-hidden rounded-t-[28px] text-foreground outline-none",
                    "md:max-h-[min(85dvh,760px)] md:rounded-[26px]",
                    size === "lg" ? "md:max-w-2xl" : "md:max-w-lg",
                    className
                  )}
                  variants={variants}
                  initial="hidden"
                  animate="shown"
                  exit="hidden"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", ...SHEET_SPRING }}
                  drag={isDesktop ? false : "y"}
                  dragListener={false}
                  dragControls={dragControls}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.7 }}
                  onDragEnd={handleDragEnd}
                >
                  <div
                    className="shrink-0 touch-none md:touch-auto"
                    onPointerDown={(event) => {
                      if (!isDesktop) dragControls.start(event);
                    }}
                  >
                    <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-muted-foreground/35 md:hidden" />
                    <div className="flex items-start gap-3 px-5 pb-3 pt-3 md:px-6 md:pt-5">
                      <div className="min-w-0 flex-1">
                        <DialogPrimitive.Title
                          className={cn("text-title3 text-foreground", hideTitle && "sr-only")}
                        >
                          {title}
                        </DialogPrimitive.Title>
                        {description && (
                          <DialogPrimitive.Description className="mt-0.5 text-footnote text-muted-foreground">
                            {description}
                          </DialogPrimitive.Description>
                        )}
                      </div>
                      <DialogPrimitive.Close
                        aria-label="Close"
                        className="-mr-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <X className="size-4" strokeWidth={2.5} />
                      </DialogPrimitive.Close>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 md:px-6",
                      footer ? "pb-4" : "pb-[calc(var(--safe-bottom)_+_20px)] md:pb-6",
                      bodyClassName
                    )}
                  >
                    {children}
                  </div>

                  {footer && (
                    <div className="shrink-0 border-t border-border/60 px-5 pb-[calc(var(--safe-bottom)_+_12px)] pt-3 md:px-6 md:pb-5">
                      {footer}
                    </div>
                  )}
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

export const SheetClose = DialogPrimitive.Close;
