"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type CardProps = {
  variant?: "surface" | "elevated";
  /** adds tactile scale-0.97 feedback on tap */
  pressable?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<HTMLMotionProps<"div">, "children" | "ref">;

const variantClasses: Record<NonNullable<CardProps["variant"]>, string> = {
  surface: "bg-surface",
  elevated: "bg-elevated",
};

/**
 * Base card. 16px radius, 20px padding by default. Everything tappable gets
 * the scale-0.97 spring-back feedback. Specific accents (gold/red/amber left
 * borders) are applied via className at the call site.
 */
export function Card({
  variant = "surface",
  pressable = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <motion.div
      whileTap={pressable ? { scale: 0.97 } : undefined}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      className={cn(
        "rounded-2xl p-5",
        variantClasses[variant],
        pressable && "cursor-pointer select-none",
        className
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
