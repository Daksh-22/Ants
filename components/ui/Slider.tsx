"use client";

import { cn } from "@/lib/utils/cn";

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
}

/**
 * Custom range slider — gold thumb, gold fill behind it, dark track ahead.
 * No native browser chrome (styled in globals.css via .ants-slider).
 */
export function Slider({ value, min, max, step = 1, onChange, className }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className={cn("ants-slider", className)}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        background: `linear-gradient(to right, var(--accent-gold) ${pct}%, var(--bg-pressed) ${pct}%)`,
      }}
    />
  );
}
