"use client";

import { useCountUp } from "@/lib/hooks/useCountUp";

interface HealthRingProps {
  score: number; // 0..100
  size?: number;
  stroke?: number;
}

function toneFor(score: number): { stroke: string; text: string; glow: string } {
  if (score < 40) return { stroke: "var(--accent-red)", text: "text-red", glow: "rgba(255,92,92,0.4)" };
  if (score < 70) return { stroke: "var(--accent-amber)", text: "text-amber", glow: "rgba(255,176,32,0.4)" };
  if (score < 90) return { stroke: "var(--accent-gold)", text: "text-gold", glow: "rgba(232,160,32,0.45)" };
  return { stroke: "var(--accent-teal)", text: "text-teal", glow: "rgba(0,214,158,0.45)" };
}

export function HealthRing({ score, size = 84, stroke = 7 }: HealthRingProps) {
  const live = useCountUp(score, 1200);
  const center = size / 2;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(Math.max(live, 0), 100) / 100);
  const tone = toneFor(score);

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      {/* Subtle background ambient ring aura */}
      <div
        className="pointer-events-none absolute inset-1 rounded-full blur-md opacity-40 transition-colors duration-500"
        style={{ backgroundColor: tone.stroke }}
      />

      {/* SVG Gauge */}
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={stroke}
        />
        {/* Progress fill */}
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={tone.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease" }}
        />
      </svg>

      {/* Centered Score Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
        <span className={`text-[26px] font-extrabold tracking-tight tabular leading-none ${tone.text}`}>
          {Math.round(live)}
        </span>
        <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-muted">
          /100
        </span>
      </div>
    </div>
  );
}
