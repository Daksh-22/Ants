"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

type DotState = "dim" | "returns" | "you";

interface RankDotProps {
  state: DotState;
  /** vertical position in the strip — drives the sequential top-to-bottom reveal */
  index: number;
}

const sizeByState: Record<DotState, number> = {
  dim: 18,
  returns: 24,
  you: 30,
};

const styleByState: Record<DotState, string> = {
  dim: "bg-pressed border border-strong opacity-60",
  returns: "bg-surface border-2 border-teal",
  you: "bg-gold-dim border-2 border-gold",
};

const glowByState: Partial<Record<DotState, string>> = {
  returns: "0 0 8px rgba(0,200,150,0.30)",
  you: "0 0 12px rgba(232,160,32,0.40)",
};

/** A single dot on the rank leaderboard strip. Appears in sequence; "you" pulses once. */
export function RankDot({ state, index }: RankDotProps) {
  const size = sizeByState[state];
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 20, delay: 0.15 + index * 0.13 }}
      className={cn("block rounded-full", styleByState[state], state === "you" && "animate-gold-pulse")}
      style={{
        width: size,
        height: size,
        boxShadow: glowByState[state],
        animationDelay: state === "you" ? `${0.9 + index * 0.13}s` : undefined,
      }}
    />
  );
}
