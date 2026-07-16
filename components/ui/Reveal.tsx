"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** position in a list — used to stagger entrance by 0.07s each (capped) */
  index?: number;
  className?: string;
}

/**
 * Card entrance: opacity 0→1, y 16→0, spring { stiffness 280, damping 24 },
 * staggered 0.07s per index (capped at 6 steps so deep lists never feel
 * laggy). Animates on mount rather than on scroll-into-view: Framer Motion's
 * whileInView + React Strict Mode's dev double-mount can leave the
 * IntersectionObserver in a broken state, permanently freezing content at
 * opacity 0 — reproduced and confirmed during testing. Animate-on-mount is
 * the reliable choice; the content is cheap enough that eagerly running the
 * entrance transition off-screen costs nothing visible.
 */
export function Reveal({ children, index = 0, className }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 280,
        damping: 24,
        delay: Math.min(index, 6) * 0.07,
      }}
    >
      {children}
    </motion.div>
  );
}
