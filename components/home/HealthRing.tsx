"use client";

import { useCountUp } from "@/lib/hooks/useCountUp";

interface HealthRingProps {
  score: number; // 0..100
  size?: number;
  stroke?: number;
}

/**
 * Circular portfolio-health ring. Fills to `score`% in gold over the count-up,
 * with the number animating in the middle — the scoreboard for "how am I doing".
 */
export function HealthRing({ score, size = 60, stroke = 6 }: HealthRingProps) {
  const live = useCountUp(score, 1300);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(Math.max(live, 0), 100) / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
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
          stroke="var(--accent-gold)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[20px] font-bold leading-none text-gold tabular">{Math.round(live)}</span>
        <span className="ml-0.5 self-end pb-1 text-[12px] text-muted">/100</span>
      </div>
    </div>
  );
}
