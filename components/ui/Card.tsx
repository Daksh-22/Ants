"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type CardProps = {
  variant?: "surface" | "elevated";
  /** adds tactile scale-0.97 feedback on tap */
  pressable?: boolean;
  /** gold ambient glow — reserved for hero/milestone cards */
  glow?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<HTMLMotionProps<"div">, "children" | "ref">;

const variantClasses: Record<NonNullable<CardProps["variant"]>, string> = {
  surface: "card-sheen",
  elevated: "card-sheen-elevated",
};

/**
 * Base card. 16px radius, 20px padding. Every card carries the sheen
 * treatment: hairline border, faint top-light, soft drop shadow — depth
 * without noise. Everything tappable gets the scale-0.97 spring-back.
 * Specific accents (gold/red/amber left borders) come via className.
 */
export function Card({
  variant = "surface",
  pressable = false,
  glow = false,
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
        glow && "shadow-glow-gold",
        pressable && "cursor-pointer select-none",
        className
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
