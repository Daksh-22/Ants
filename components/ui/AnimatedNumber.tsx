"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { cn } from "@/lib/utils/cn";

interface AnimatedNumberProps {
  value: number;
  /** formats the live numeric value for display */
  format: (n: number) => string;
  duration?: number;
  className?: string;
}

/**
 * Renders a number that counts up from 0 (or its previous value) on mount.
 * The scoreboard moment — used for every hero figure, return % and rank.
 * Lands with a settle pop: a small scale tick, colored by whether the value
 * rose or fell versus what was there before.
 */
export function AnimatedNumber({ value, format, duration = 1200, className }: AnimatedNumberProps) {
  const [settled, setSettled] = useState(false);
  const prevValue = useRef(value);
  const direction = useRef<"up" | "down" | null>(null);

  const live = useCountUp(value, duration, () => {
    direction.current = value > prevValue.current ? "up" : value < prevValue.current ? "down" : null;
    setSettled(true);
    prevValue.current = value;
    setTimeout(() => setSettled(false), 400);
  });

  return (
    <motion.span
      animate={settled ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={{ duration: 0.35 }}
      className={cn("tabular inline-block", className)}
    >
      {format(live)}
    </motion.span>
  );
}
