"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Quick enter-only fade keyed by pathname so tab switches feel instant, like iOS.
 * Honors `prefers-reduced-motion` automatically via CSS.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default RouteTransition;
