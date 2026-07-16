"use client";

import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import type { BenchmarkComparison as BenchmarkComparisonType } from "@/lib/insights/types";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { formatPercent } from "@/lib/utils/formatPercent";
import { cn } from "@/lib/utils/cn";

interface BenchmarkComparisonProps {
  benchmarks: BenchmarkComparisonType;
  index?: number;
}

function benchmarkCopy(b: BenchmarkComparisonType): string {
  const beatsNifty = b.outperformance.vs_nifty50 > 0;
  const beatsSensex = b.outperformance.vs_sensex > 0;
  const beatsMicro = b.outperformance.vs_nifty_micro_cap > 0;

  if (beatsNifty && beatsSensex && beatsMicro)
    return "You're ahead of all three benchmarks. That's genuinely rare — most portfolios (and most fund managers) don't manage it. Don't get cocky, but do take the W.";
  if (beatsNifty && beatsSensex)
    return "Ahead of the big indices, behind micro caps. Micro caps ran hot this year — chasing them now usually means buying the top.";
  if (beatsNifty)
    return "You're beating Nifty 50 — your picks are earning their place. The Sensex gap is small enough to be noise.";
  return "The index is beating you right now. Worth asking: would a plain Nifty 50 index fund be doing this job better? That question is the whole point of this screen.";
}

/**
 * Benchmark comparison — one row per index on a shared, ZERO-CENTERED axis so
 * a loss and a gain of the same size draw in opposite directions, not the
 * same length. Beating all three promotes the percentile to a gold trophy
 * pill with a one-time sheen sweep across the card.
 */
export function BenchmarkComparison({ benchmarks, index = 0 }: BenchmarkComparisonProps) {
  const rows = [
    { label: "Your portfolio", value: benchmarks.user_return_pct, you: true },
    { label: "Nifty 50", value: benchmarks.nifty50_return_pct, you: false },
    { label: "Sensex", value: benchmarks.sensex_return_pct, you: false },
    { label: "Nifty Micro Cap", value: benchmarks.nifty_micro_cap_return_pct, you: false },
  ];
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.value)), 1);

  const deltas = [
    { label: "vs Nifty 50", value: benchmarks.outperformance.vs_nifty50 },
    { label: "vs Sensex", value: benchmarks.outperformance.vs_sensex },
  ];

  const beatsAll =
    benchmarks.outperformance.vs_nifty50 > 0 &&
    benchmarks.outperformance.vs_sensex > 0 &&
    benchmarks.outperformance.vs_nifty_micro_cap > 0;

  return (
    <Reveal index={index}>
      <Card className={cn("relative overflow-hidden", beatsAll && "border border-gold/30 shadow-glow-gold")}>
        {beatsAll && <SheenSweep />}
        <div className="mb-4 flex items-baseline justify-between">
          <p className="text-[15px] font-semibold text-primary">Same money, four homes</p>
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.3 }}
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
              beatsAll ? "fill-gold-gradient text-ink shadow-cta" : "bg-gold-dim text-gold"
            )}
          >
            {beatsAll && <Trophy size={11} strokeWidth={2.8} />}
            Top{" "}
            <AnimatedNumber
              value={100 - benchmarks.rank_percentile}
              format={(n) => `${Math.round(n)}%`}
              className="tabular"
            />
          </motion.span>
        </div>

        {/* bars on a shared, zero-centered axis */}
        <div className="space-y-3">
          {rows.map((row, i) => {
            const isNeg = row.value < 0;
            const widthPct = (Math.abs(row.value) / maxAbs) * 50;
            return (
              <div key={row.label}>
                <div className="flex items-baseline justify-between">
                  <p
                    className={cn(
                      "text-[13px]",
                      row.you ? "font-bold text-primary" : "font-medium text-secondary"
                    )}
                  >
                    {row.label}
                  </p>
                  <AnimatedNumber
                    value={row.value}
                    format={(n) => formatPercent(n)}
                    className={cn(
                      "text-[13px] font-bold tabular",
                      row.value >= 0 ? "text-teal" : "text-red"
                    )}
                  />
                </div>
                <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-elevated">
                  {/* zero axis marker at the center */}
                  <span className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 22, delay: 0.15 + i * 0.08 }}
                    className={cn(
                      "absolute inset-y-0 h-full rounded-full",
                      isNeg ? "right-1/2" : "left-1/2",
                      row.you ? "bg-gold" : row.value >= 0 ? "bg-teal" : "bg-red"
                    )}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* the deltas */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-subtle pt-5">
          {deltas.map((d) => {
            const winning = d.value > 0;
            return (
              <div
                key={d.label}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-center",
                  winning ? "bg-teal-dim" : "bg-red-dim"
                )}
              >
                <p className={cn("text-[11px] font-semibold", winning ? "text-teal" : "text-red")}>
                  {d.label}
                </p>
                <AnimatedNumber
                  value={d.value}
                  format={(n) => formatPercent(n)}
                  className={cn("mt-0.5 block text-[17px] font-extrabold tabular", winning ? "text-teal" : "text-red")}
                />
              </div>
            );
          })}
        </div>

        {/* the read */}
        <div className="mt-4 rounded-xl bg-elevated p-3.5">
          <p className="text-label uppercase text-muted">the read</p>
          <p className="mt-1.5 text-[13px] leading-[1.55] text-secondary">{benchmarkCopy(benchmarks)}</p>
        </div>
      </Card>
    </Reveal>
  );
}

function SheenSweep() {
  return (
    <motion.div
      initial={{ x: "-120%" }}
      animate={{ x: "120%" }}
      transition={{ duration: 1.4, ease: "easeInOut", delay: 0.4 }}
      className="pointer-events-none absolute inset-y-0 left-0 w-1/3 skew-x-[-15deg] bg-gradient-to-r from-transparent via-gold/15 to-transparent"
    />
  );
}
