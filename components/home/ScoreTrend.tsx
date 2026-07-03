"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
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

/**
 * The health score's pulse — a sparkline of every score the user has ever
 * seen, recorded locally. No card until there are at least two points:
 * a single number isn't a trend, it's a dot.
 */
export function ScoreTrend({ score }: { score: number }) {
  const [history, setHistory] = useState<ScorePoint[]>([]);

  useEffect(() => {
    const stored = readHistory();
    const last = stored[stored.length - 1];
    if (!last || last.score !== score) {
      stored.push({ t: Date.now(), score });
    }
    const next = stored.slice(-MAX_ENTRIES);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // persistence is best-effort — the sparkline still renders this session
    }
    setHistory(next);
  }, [score]);

  if (history.length < 2) return null;

  const delta = history[history.length - 1].score - history[0].score;

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
        <ResponsiveContainer width="100%" height={64}>
          <AreaChart data={history} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="score-trend-gold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-gold)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent-gold)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="score"
              stroke="var(--accent-gold)"
              strokeWidth={2}
              fill="url(#score-trend-gold)"
              dot={false}
              isAnimationActive={false}
            />
            <YAxis
              hide
              domain={[
                (min: number) => Math.max(0, min - 5),
                (max: number) => Math.min(100, max + 5),
              ]}
            />
            <XAxis hide dataKey="t" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
