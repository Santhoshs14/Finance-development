"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

/**
 * Wraps page content with a Framer Motion fade+slide transition keyed
 * by pathname. Honors `prefers-reduced-motion` automatically via CSS.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={variants}
        initial="initial"
        animate="enter"
        exit="exit"
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default RouteTransition;
