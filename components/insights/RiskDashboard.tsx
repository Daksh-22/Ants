"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { RiskMetrics, HoldingVolatility } from "@/lib/insights/types";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils/cn";

const RISK_HISTORY_KEY = "ants:risk-score-history";

interface RiskDashboardProps {
  riskMetrics: RiskMetrics;
  holdingVolatilities: HoldingVolatility[];
  index?: number;
}

/** teal = safe, amber = watch it, red = trouble — same roles as everywhere else */
function riskTone(riskScore: number): string {
  if (riskScore >= 70) return "text-teal";
  if (riskScore >= 50) return "text-amber";
  return "text-red";
}

function riskGlow(riskScore: number): string {
  if (riskScore >= 70) return "rgba(0,214,158,0.35)";
  if (riskScore >= 50) return "rgba(255,176,32,0.35)";
  return "rgba(255,92,92,0.35)";
}

function riskLabel(riskScore: number): string {
  if (riskScore >= 80) return "Low risk";
  if (riskScore >= 60) return "Moderate";
  if (riskScore >= 40) return "Elevated";
  return "High risk";
}

function sharpeRead(sharpe: number): string {
  if (sharpe >= 1.5) return "excellent";
  if (sharpe >= 1.0) return "good";
  if (sharpe >= 0.5) return "fair";
  return "weak";
}

function riskCopy(riskScore: number): string {
  if (riskScore >= 70)
    return "Balanced book. Your returns aren't riding on one wild sector — market swings will sting, not wreck.";
  if (riskScore >= 50)
    return "Moderate risk. A rough month in your heaviest sector will show up in your total. Trimming concentration is the cheapest insurance.";
  return "Volatile book. Your money is concentrated where prices swing hardest — diversifying across sectors would calm this down fast.";
}

/** last risk_score seen, so the ring can show a "since last scan" delta */
function usePriorRiskScore(current: number): number | null {
  const [prior, setPrior] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RISK_HISTORY_KEY);
      const last = raw ? (JSON.parse(raw) as number) : null;
      setPrior(typeof last === "number" ? last : null);
      localStorage.setItem(RISK_HISTORY_KEY, JSON.stringify(current));
    } catch {
      // best-effort — no memory this session
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return prior;
}

/**
 * Risk profile — the honest twin of the health ring. Score ring (100 = calm)
 * with a soft matching glow, the three numbers that matter, which holdings
 * are doing the damage, and a delta chip against the last time this scan ran.
 */
export function RiskDashboard({ riskMetrics, holdingVolatilities, index = 0 }: RiskDashboardProps) {
  const RING_C = 2 * Math.PI * 45; // circumference for r=45
  const prior = usePriorRiskScore(riskMetrics.risk_score);
  const delta = prior != null ? riskMetrics.risk_score - prior : null;

  return (
    <div className="space-y-3">
      {/* risk ring + read */}
      <Reveal index={index}>
        <Card className="flex items-center gap-4">
          <div
            className="relative h-24 w-24 shrink-0 [filter:drop-shadow(0_0_8px_var(--risk-glow))]"
            style={{ ["--risk-glow" as string]: riskGlow(riskMetrics.risk_score) }}
          >
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke="var(--bg-elevated)" strokeWidth="8"
              />
              <motion.circle
                cx="50" cy="50" r="45" fill="none"
                stroke="currentColor" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={RING_C}
                initial={{ strokeDashoffset: RING_C }}
                animate={{ strokeDashoffset: RING_C * (1 - riskMetrics.risk_score / 100) }}
                transition={{ type: "spring", stiffness: 120, damping: 22, delay: 0.2 }}
                className={riskTone(riskMetrics.risk_score)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <AnimatedNumber
                value={riskMetrics.risk_score}
                format={(n) => Math.round(n).toString()}
                className="text-[22px] font-extrabold text-primary"
              />
              <span className="text-[10px] uppercase tracking-wide text-muted">risk score</span>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className={cn("text-[16px] font-semibold", riskTone(riskMetrics.risk_score))}>
                {riskLabel(riskMetrics.risk_score)}
              </p>
              {delta !== null && delta !== 0 && (
                <span className={cn("text-[11px] font-bold tabular", delta > 0 ? "text-teal" : "text-red")}>
                  {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} since last scan
                </span>
              )}
            </div>
            <p className="mt-1 text-[12px] text-muted">
              Sharpe <span className="font-semibold text-secondary tabular">{riskMetrics.sharpe_ratio}</span>{" "}
              — {sharpeRead(riskMetrics.sharpe_ratio)} return for the risk taken
            </p>
            <p className="mt-0.5 text-[12px] text-muted">
              Beta <span className="font-semibold text-secondary tabular">{riskMetrics.beta_vs_nifty}</span>{" "}
              vs Nifty 50
            </p>
          </div>
        </Card>
      </Reveal>

      {/* the two numbers people actually feel */}
      <div className="grid grid-cols-2 gap-3">
        <Reveal index={index + 1}>
          <Card className="py-4 text-center">
            <AnimatedNumber
              value={riskMetrics.volatility_pct}
              format={(n) => `${n.toFixed(1)}%`}
              className="text-[22px] font-extrabold text-primary"
            />
            <p className="mt-1 text-[11px] text-muted">annual volatility</p>
            <p className="text-[11px] text-amber">how much it swings</p>
          </Card>
        </Reveal>

        <Reveal index={index + 2}>
          <Card className="py-4 text-center">
            <AnimatedNumber
              value={Math.abs(riskMetrics.max_drawdown_pct)}
              format={(n) => `−${n.toFixed(1)}%`}
              className="text-[22px] font-extrabold text-primary"
            />
            <p className="mt-1 text-[11px] text-muted">est. max drawdown</p>
            <p className="text-[11px] text-red">bad-year scenario</p>
          </Card>
        </Reveal>
      </div>

      {/* who's driving the risk */}
      {holdingVolatilities.length > 0 && (
        <Reveal index={index + 3}>
          <Card>
            <p className="mb-3 text-[13px] font-semibold text-primary">Biggest risk contributors</p>
            <div className="space-y-2.5">
              {holdingVolatilities.slice(0, 3).map((h) => (
                <div key={h.ticker} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-primary">{h.ticker}</p>
                    <p className="text-[11px] text-muted">
                      {h.sector} · {h.volatility_pct}% sector vol
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-bold text-amber tabular">
                    {h.contribution_to_portfolio_risk}%
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      )}

      {/* what it means, in the house voice */}
      <Reveal index={index + 4}>
        <Card variant="elevated">
          <p className="text-label uppercase text-muted">what this means</p>
          <p className="mt-2 text-[14px] leading-[1.55] text-secondary">
            {riskCopy(riskMetrics.risk_score)}
          </p>
        </Card>
      </Reveal>
    </div>
  );
}
