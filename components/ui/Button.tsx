"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "ghost" | "link";

type ButtonProps = {
  variant?: Variant;
  className?: string;
  children: ReactNode;
} & Omit<HTMLMotionProps<"button">, "children" | "ref">;

const variantClasses: Record<Variant, string> = {
  // gold is the brand — every primary CTA is gold
  primary: "bg-gold text-ink font-bold px-5 py-3 rounded-xl text-[15px]",
  ghost: "bg-pressed text-primary font-semibold px-5 py-3 rounded-xl text-[15px]",
  // text-only gold link — "no button" style the spec asks for in several places
  link: "text-gold font-semibold text-[14px]",
};

export function Button({ variant = "primary", className, children, ...rest }: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      className={cn("inline-flex items-center justify-center gap-1", variantClasses[variant], className)}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
