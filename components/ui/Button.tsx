"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "ghost" | "link";

type ButtonProps = {
  variant?: Variant;
  /** swaps children for a spinner while keeping the button's width */
  loading?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<HTMLMotionProps<"button">, "children" | "ref">;

const variantClasses: Record<Variant, string> = {
  // gold is the brand — every primary CTA is the gold gradient with a soft lift
  primary:
    "fill-gold-gradient text-ink font-bold px-5 py-3 rounded-xl text-[15px] shadow-cta",
  ghost:
    "bg-pressed text-primary font-semibold px-5 py-3 rounded-xl text-[15px] border border-subtle",
  // text-only gold link — "no button" style the spec asks for in several places
  link: "text-gold font-semibold text-[14px]",
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      whileHover={!disabled && !loading ? { filter: "brightness(1.06)" } : undefined}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex items-center justify-center gap-1 transition-opacity",
        variantClasses[variant],
        (disabled || loading) && "opacity-40 pointer-events-none",
        className
      )}
      {...rest}
    >
      <span className={cn("inline-flex items-center gap-1", loading && "invisible")}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={18} className="animate-spin" />
        </span>
      )}
    </motion.button>
  );
}
