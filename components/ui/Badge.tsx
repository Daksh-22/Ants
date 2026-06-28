import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "gain" | "loss" | "gold" | "warn" | "purple";
type Size = "sm" | "md";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-pressed text-secondary",
  gain: "bg-teal-dim text-teal",
  loss: "bg-red-dim text-red",
  gold: "bg-gold-dim text-gold",
  warn: "bg-amber-dim text-amber",
  purple: "bg-purple-dim text-purple",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-[11px]",
};

/** Pill badge. Tone carries meaning — gain=teal, loss=red, warn=amber, gold=brand. */
export function Badge({
  children,
  tone = "neutral",
  size = "md",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  size?: Size;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold leading-none",
        toneClasses[tone],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}
