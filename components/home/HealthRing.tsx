"use client";

import { useCountUp } from "@/lib/hooks/useCountUp";

interface HealthRingProps {
  score: number; // 0..100
  size?: number;
  stroke?: number;
}

/** semantic color ramp — the ring should look as bad as a bad score IS */
function toneFor(score: number): { stroke: string; text: string; glow: string } {
  if (score < 40) return { stroke: "var(--accent-red)", text: "text-red", glow: "rgba(255,92,92,0.35)" };
  if (score < 70) return { stroke: "var(--accent-amber)", text: "text-amber", glow: "rgba(255,176,32,0.35)" };
  if (score < 90) return { stroke: "var(--accent-gold)", text: "text-gold", glow: "rgba(232,160,32,0.4)" };
  return { stroke: "var(--accent-teal)", text: "text-teal", glow: "rgba(0,214,158,0.4)" };
}

/**
 * Circular portfolio-health ring. Fills to `score`% over the count-up, with
 * the number animating in the middle. Color ramps red → amber → gold → teal
 * so a disaster portfolio never renders in the same triumphant gold as a 95.
 */
export function HealthRing({ score, size = 76, stroke = 7 }: HealthRingProps) {
  const live = useCountUp(score, 1300);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(Math.max(live, 0), 100) / 100);
  const tone = toneFor(score);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 [filter:drop-shadow(0_0_6px_var(--ring-glow))]" style={{ ["--ring-glow" as string]: tone.glow }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-[24px] font-bold leading-none tabular ${tone.text}`}>{Math.round(live)}</span>
        <span className="ml-0.5 self-end pb-1 text-[12px] text-muted">/100</span>
      </div>
    </div>
  );
}
