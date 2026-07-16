"use client";

import { motion } from "framer-motion";

/**
 * Page transition — every tab switch fades + slides in gently (180ms).
 * Subtle on purpose: it makes navigation feel fluid without ever making
 * the user wait for chrome.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
