"use client";

import { useCallback, useRef } from "react";
import confetti from "canvas-confetti";

const MILESTONES = [25, 50, 75, 100] as const;

/**
 * Hook that fires confetti when a goal crosses a milestone.
 * Tracks previously-seen percentages to fire only once per milestone.
 */
export function useCelebration() {
  const firedRef = useRef<Record<string, Set<number>>>({});

  const celebrate = useCallback((goalId: string, prevPercent: number, newPercent: number) => {
    if (!firedRef.current[goalId]) {
      firedRef.current[goalId] = new Set();
    }
    const fired = firedRef.current[goalId];

    for (const milestone of MILESTONES) {
      if (prevPercent < milestone && newPercent >= milestone && !fired.has(milestone)) {
        fired.add(milestone);
        fireConfetti(milestone);
        break; // Only fire the highest new milestone
      }
    }
  }, []);

  const fireGoalComplete = useCallback(() => {
    fireConfetti(100);
  }, []);

  return { celebrate, fireGoalComplete };
}

function fireConfetti(milestone: number) {
  const intensity = milestone === 100 ? 1 : milestone >= 75 ? 0.7 : 0.4;

  // Center burst
  confetti({
    particleCount: Math.round(80 * intensity),
    spread: 60 + intensity * 40,
    origin: { y: 0.6 },
    colors: ["#0080ff", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444"],
  });

  if (milestone === 100) {
    // Extra side bursts for 100%
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ["#0080ff", "#f59e0b", "#10b981"],
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ["#0080ff", "#f59e0b", "#10b981"],
      });
    }, 200);
  }
}
