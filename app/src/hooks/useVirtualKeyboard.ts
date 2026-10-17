"use client";

import { useEffect, useState } from "react";

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function isTextEntry(el: Element | null): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Tracks the on-screen keyboard on touch devices and publishes how much of the
 * layout viewport it covers as `--kb-inset` so fixed bottom UI can ride above it.
 */
export function useVirtualKeyboard(): { open: boolean } {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const viewport = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;

    const sync = () => {
      frame = 0;
      const focused = isTextEntry(document.activeElement);
      const inset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      setOpen(focused);
      root.style.setProperty("--kb-inset", `${focused ? Math.round(inset) : 0}px`);
    };

    // focusout fires before the next field receives focus, so settle on the next frame
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };

    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    return () => {
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      if (frame) cancelAnimationFrame(frame);
      root.style.removeProperty("--kb-inset");
    };
  }, []);

  return { open };
}
