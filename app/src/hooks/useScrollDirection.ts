"use client";

import { useEffect, useState } from "react";

export interface ScrollDirectionState {
  direction: "up" | "down";
  /** Within `topOffset` of the top of the page. */
  atTop: boolean;
  atBottom: boolean;
}

interface Options {
  /** Minimum accumulated scroll distance before the direction flips. */
  threshold?: number;
  topOffset?: number;
}

export function useScrollDirection({ threshold = 12, topOffset = 80 }: Options = {}): ScrollDirectionState {
  const [state, setState] = useState<ScrollDirectionState>({ direction: "up", atTop: true, atBottom: false });

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      // iOS rubber-band overscroll reports positions outside the scrollable range
      if (y < 0 || y > max) return;

      const atTop = y < topOffset;
      const atBottom = max - y < 8;
      const delta = y - lastY;
      if (Math.abs(delta) < threshold && !atTop && !atBottom) return;
      lastY = y;

      const direction = atTop || atBottom || delta < 0 ? "up" : "down";
      setState((prev) =>
        prev.direction === direction && prev.atTop === atTop && prev.atBottom === atBottom
          ? prev
          : { direction, atTop, atBottom }
      );
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [threshold, topOffset]);

  return state;
}
