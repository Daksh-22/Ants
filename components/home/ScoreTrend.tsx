"use client";

import { useEffect, useRef, useState } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { cn } from "@/lib/utils/cn";

const HISTORY_KEY = "ants:score-history";
const MAX_ENTRIES = 60;

interface ScorePoint {
  /** Date.now() at the moment the score changed */
  t: number;
  score: number;
}

function readHistory(): ScorePoint[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is ScorePoint =>
        !!p && typeof p.t === "number" && typeof p.score === "number"
    );
  } catch {
    return [];
  }
}

// the next label-flipping threshold above the current score
function nextMilestone(score: number): { value: number; label: string } | null {
  const thresholds: [number, string][] = [
    [40, "Needs work → Decent start"],
    [60, "Decent start → Strong portfolio"],
    [80, "Strong portfolio → Crushing it"],
    [90, "one step from perfect"],
  ];
  for (const [value, label] of thresholds) {
    if (score < value) return { value, label };
  }
  return null;
}

/**
 * The health score's pulse — a sparkline of every score the user has ever
 * seen, recorded locally, read synchronously so the card never pops in late.
 * A dotted reference line marks the next milestone threshold — the sparkline
 * shows where you've been AND where to go next.
 */
export function ScoreTrend({ score }: { score: number }) {
  // lazy initializer: seed synchronously from localStorage + today's score so
  // the card never renders null-then-pops-in on mount
  const [history, setHistory] = useState<ScorePoint[]>(() => {
    const stored = readHistory();
    const last = stored[stored.length - 1];
    if (!last || last.score !== score) stored.push({ t: Date.now(), score });
    return stored.slice(-MAX_ENTRIES);
  });
  const mounted = useRef(false);

  // subsequent score changes (marking a fix done, etc.) append a new point
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      } catch {
        // best-effort
      }
      return;
    }
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.score === score) return prev;
      const next = [...prev, { t: Date.now(), score }].slice(-MAX_ENTRIES);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // best-effort
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  if (history.length < 2) return null;

  const delta = history[history.length - 1].score - history[0].score;
  const milestone = nextMilestone(score);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Score trend</SectionLabel>
        {delta === 0 ? (
          <span className="text-[12px] font-semibold text-muted">holding steady</span>
        ) : (
          <span
            className={cn(
              "text-[12px] font-semibold tabular",
              delta > 0 ? "text-teal" : "text-red"
            )}
          >
            {delta > 0 ? `+${delta}` : delta} since your first scan
          </span>
        )}
      </div>
      <div className="mt-3">
        <ResponsiveContainer width="100%" height={72}>
          <AreaChart data={history} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="score-trend-gold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-gold)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent-gold)" stopOpacity={0} />
              </linearGradient>
            </defs>
            {milestone && (
              <ReferenceLine
                y={milestone.value}
                stroke="var(--accent-gold)"
                strokeDasharray="3 4"
                strokeOpacity={0.5}
              />
            )}
            <Area
              type="monotone"
              dataKey="score"
              stroke="var(--accent-gold)"
              strokeWidth={2}
              fill="url(#score-trend-gold)"
              dot={false}
              activeDot={{ r: 4, fill: "var(--accent-gold)", stroke: "var(--bg-surface)", strokeWidth: 2 }}
              isAnimationActive
              animationDuration={700}
            />
            <YAxis
              hide
              domain={[
                (min: number) => Math.max(0, min - 5),
                (max: number) => Math.min(100, Math.max(max, milestone?.value ?? 0) + 5),
              ]}
            />
            <XAxis hide dataKey="t" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {milestone && (
        <p className="mt-1 text-right text-[11px] text-muted">
          <span className="font-semibold text-gold">{milestone.value}</span> — {milestone.label} ·{" "}
          {milestone.value - score} pt{milestone.value - score === 1 ? "" : "s"} away
        </p>
      )}
    </Card>
  );
}
