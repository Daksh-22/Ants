"use client";

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
 */
export function AnimatedNumber({ value, format, duration = 1200, className }: AnimatedNumberProps) {
  const live = useCountUp(value, duration);
  return <span className={cn("tabular", className)}>{format(live)}</span>;
}
