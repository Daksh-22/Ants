"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { Slider } from "@/components/ui/Slider";
import { RankDot } from "@/components/ui/RankDot";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { rank } from "@/lib/data/mock";
import { formatINR } from "@/lib/utils/formatINR";
import { formatPercent } from "@/lib/utils/formatPercent";
import { cn } from "@/lib/utils/cn";

const clamp = (n: number, lo: number) => Math.max(lo, n);

export default function RankPage() {
  const [extra, setExtra] = useState(500);

  // more monthly investment → better (lower) percentile. Clamped to a floor.
  const threeMonth = clamp(rank.wealthPercentile - Math.round(extra / 250), 8);
  const oneYear = clamp(rank.wealthPercentile - Math.round(extra / 110), 5);

  return (
    <div className="px-5 pt-7">
      {/* ───── Header ───── */}
      <Reveal>
        <h1 className="text-[22px] font-bold text-primary">Where you stand</h1>
        <SectionLabel className="mt-1.5">INVESTORS AGED 22-27 · BENGALURU</SectionLabel>
      </Reveal>

      {/* ───── The rank ladder — the scoreboard, no gauge ───── */}
      <Reveal index={1}>
        <div className="relative mx-auto mt-8 flex h-[280px] flex-col justify-between">
          {/* thin connector line threaded through the dots, centered */}
          <span className="pointer-events-none absolute left-1/2 top-2 bottom-2 -translate-x-1/2 w-px bg-pressed" />

          {rank.strip.map((pos, i) => {
            const state =
              pos.label === "You" ? "you" : pos.label === "Returns rank" ? "returns" : "dim";
            const isYou = state === "you";
            const isReturns = state === "returns";

            return (
              <div key={i} className="relative grid grid-cols-2 items-center">
                {/* LEFT: "Top X%" label */}
                <div className="flex justify-end pr-7 text-right">
                  {isYou ? (
                    <AnimatedNumber
                      value={pos.percentile}
                      format={(n) => "Top " + Math.round(n) + "%"}
                      className="text-[26px] font-extrabold leading-none text-gold"
                    />
                  ) : (
                    <span
                      className={cn(
                        "text-[13px] font-semibold tabular leading-none",
                        isReturns ? "text-secondary" : "text-muted"
                      )}
                    >
                      Top {pos.percentile}%
                    </span>
                  )}
                </div>

                {/* CENTER: the dot, pinned to the connector line */}
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <RankDot state={state} index={i} />
                </span>

                {/* RIGHT: contextual labels */}
                <div className="flex flex-col gap-1 pl-7">
                  {isReturns && (
                    <span className="text-[12px] font-semibold text-teal">Returns rank</span>
                  )}
                  {isYou && (
                    <>
                      <span className="text-[14px] font-bold text-gold">You ←</span>
                      <Badge tone="gain" size="sm" className="w-fit">
                        ↑ up 3% this month
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>

      {/* ───── What moved you ───── */}
      <Reveal index={2}>
        <section className="mt-9">
          <h2 className="text-heading font-semibold text-primary">What moved you</h2>
          <div className="mt-4 space-y-3.5">
            {rank.movers.map((mover) => (
              <div key={mover.label} className="flex items-center">
                <span className="text-[14px] text-secondary">{mover.label}</span>
                <span className="leader" />
                <span className="text-[14px] font-semibold tabular text-teal">
                  {formatPercent(mover.delta)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ───── Climb faster ───── */}
      <Reveal index={3}>
        <section className="mt-9">
          <h2 className="text-heading font-semibold text-primary">Climb faster</h2>
          <p className="mt-1.5 text-[14px] text-secondary">
            Invest ₹500 more each month and watch what happens
          </p>

          <Card className="mt-4 p-5">
            {/* current pick */}
            <div className="flex items-baseline justify-between">
              <SectionLabel>Extra each month</SectionLabel>
              <span className="text-[18px] font-bold tabular text-gold">
                {formatINR(extra)}/mo
              </span>
            </div>

            <Slider
              value={extra}
              min={0}
              max={5000}
              step={500}
              onChange={setExtra}
              className="mt-4"
            />

            {/* live projections — no submit button */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-pressed px-4 py-3.5">
                <SectionLabel>3 months</SectionLabel>
                <p className="mt-1.5 text-[20px] font-extrabold tabular text-primary">
                  Top {threeMonth}%
                </p>
              </div>
              <div className="rounded-xl bg-gold-dim px-4 py-3.5">
                <SectionLabel className="text-gold/70">1 year</SectionLabel>
                <p className="mt-1.5 text-[20px] font-extrabold tabular text-gold">
                  Top {oneYear}%
                </p>
              </div>
            </div>
          </Card>

          <p className="mt-3 text-[10px] text-muted">
            Projection based on cohort data. Not a guarantee.
          </p>
        </section>
      </Reveal>
    </div>
  );
}
