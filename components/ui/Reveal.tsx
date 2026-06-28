"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** position in a list — used to stagger entrance by 0.07s each */
  index?: number;
  className?: string;
}

/**
 * Card entrance: opacity 0→1, y 16→0, spring { stiffness 280, damping 24 },
 * staggered 0.07s per index. The constant forward-momentum feel.
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
        delay: index * 0.07,
      }}
    >
      {children}
    </motion.div>
  );
}
