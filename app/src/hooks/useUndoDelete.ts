"use client";

import { useCallback, useRef, createElement } from "react";
import toast from "react-hot-toast";

interface UndoDeleteOptions<T> {
  /** Function to perform the actual delete */
  deleteFn: (id: string) => Promise<unknown>;
  /** Label for the toast (e.g. "Transaction", "Budget") */
  entityName: string;
  /** Optional callback on successful delete */
  onDeleted?: (id: string) => void;
  /** Optional callback when undo is triggered */
  onUndo?: (id: string, snapshot: T | undefined) => void;
  /** Delay in ms before deletion is committed (default 5000) */
  delay?: number;
}

/**
 * Hook providing a "soft delete" with 5-second undo window.
 * Shows a toast with an "Undo" button. If the user clicks Undo,
 * the delete is cancelled. Otherwise, the delete is committed after the delay.
 */
export function useUndoDelete<T = unknown>(options: UndoDeleteOptions<T>) {
  const { deleteFn, entityName, onDeleted, onUndo, delay = 5000 } = options;
  const pendingRef = useRef<Map<string, { timer: ReturnType<typeof setTimeout>; toastId: string }>>(new Map());

  const softDelete = useCallback(
    (id: string, snapshot?: T) => {
      // Cancel any existing pending delete for this id
      const existing = pendingRef.current.get(id);
      if (existing) {
        clearTimeout(existing.timer);
        toast.dismiss(existing.toastId);
      }

      const toastId = toast(
        (t) =>
          createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "12px" } },
            createElement("span", { style: { fontSize: "14px" } }, `${entityName} deleted`),
            createElement(
              "button",
              {
                onClick: () => {
                  const pending = pendingRef.current.get(id);
                  if (pending) {
                    clearTimeout(pending.timer);
                    pendingRef.current.delete(id);
                  }
                  toast.dismiss(t.id);
                  toast.success(`${entityName} restored`);
                  onUndo?.(id, snapshot);
                },
                style: {
                  fontWeight: 600,
                  fontSize: "13px",
                  color: "#0080ff",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                },
              },
              "Undo"
            )
          ),
        { duration: delay + 500, id: `undo-${id}` }
      );

      const timer = setTimeout(async () => {
        pendingRef.current.delete(id);
        try {
          await deleteFn(id);
          onDeleted?.(id);
        } catch (err) {
          toast.error(`Failed to delete ${entityName.toLowerCase()}`);
          onUndo?.(id, snapshot);
          console.error(err);
        }
      }, delay);

      pendingRef.current.set(id, { timer, toastId: toastId as string });
    },
    [deleteFn, entityName, onDeleted, onUndo, delay]
  );

  const cancelAll = useCallback(() => {
    pendingRef.current.forEach(({ timer, toastId }) => {
      clearTimeout(timer);
      toast.dismiss(toastId);
    });
    pendingRef.current.clear();
  }, []);

  return { softDelete, cancelAll };
}
