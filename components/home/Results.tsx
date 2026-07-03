"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import dynamic from "next/dynamic";
import { HealthRing } from "@/components/home/HealthRing";
import { FixSheet } from "@/components/home/FixSheet";
import { AskAnts } from "@/components/home/AskAnts";
import { TipCheck } from "@/components/home/TipCheck";

// recharts is heavy — load the sparkline lazily so first paint stays light
const ScoreTrend = dynamic(
  () => import("@/components/home/ScoreTrend").then((m) => m.ScoreTrend),
  { ssr: false }
);
import { useAppState } from "@/components/app/AppState";
import { DEFAULT_ANALYSIS } from "@/lib/analysis/default";
import type { AnalysisFlag, FixPlan } from "@/lib/analysis/types";
import { formatINR } from "@/lib/utils/formatINR";
import { formatPercent } from "@/lib/utils/formatPercent";
import { cn } from "@/lib/utils/cn";

type Tone = "red" | "amber" | "teal";
const accent: Record<Tone, { border: string; dot: string }> = {
  red: { border: "border-red", dot: "bg-red" },
  amber: { border: "border-amber", dot: "bg-amber" },
  teal: { border: "border-teal", dot: "bg-teal" },
};

function scoreLabelFor(score: number, fallback: string): string {
  if (score >= 90) return "You're crushing it.";
  if (score >= 80) return "Strong portfolio.";
  if (score >= 60) return "Decent start.";
  if (score >= 40) return "Needs work.";
  return fallback;
}

function InsightCard({
  tone,
  label,
  children,
  done,
  actionText,
  onAction,
}: {
  tone: Tone;
  label: string;
  children: ReactNode;
  done?: boolean;
  actionText?: string;
  onAction?: () => void;
}) {
  // a resolved problem turns from red/amber to teal — a visible reward
  const t: Tone = done ? "teal" : tone;
  return (
    <Card className={cn("border-l-[3px]", accent[t].border)}>
      <div className="flex items-center gap-2">
        <span className={cn("h-1.5 w-1.5 rounded-full", accent[t].dot)} />
        <span className="text-label uppercase text-muted">{label}</span>
      </div>
      <p className="mt-2.5 text-[14px] leading-[1.55] text-secondary">{children}</p>
      {done ? (
        <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-teal-dim px-2.5 py-1 text-[12px] font-semibold text-teal">
          <Check size={12} strokeWidth={3} />
          Sorted
        </span>
      ) : actionText && onAction ? (
        <button
          onClick={onAction}
          className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-gold"
        >
          {actionText}
          <ArrowRight size={13} strokeWidth={2.6} />
        </button>
      ) : null}
    </Card>
  );
}

const sourceLabels: Record<string, string> = {
  manual: "from your entered positions",
  screenshot: "read from your screenshot",
  broker: "synced via Account Aggregator",
  demo: "demo portfolio",
};

/**
 * STATE 2 — home after analysis. Renders the LIVE analysis from the backend
 * (manual / screenshot / broker), falling back to the built-in demo. Flags,
 * fixes, score and copy all come from the analysis object; marking a fix done
 * climbs the ring, flips the card teal, and drops the attention count.
 */
export function Results() {
  const { analysis: stored, doneFixes, markFixDone, reset } = useAppState();
  const analysis = stored ?? DEFAULT_ANALYSIS;

  const [openFixId, setOpenFixId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);

  const fixesById = useMemo(() => {
    const map = new Map<string, FixPlan>();
    for (const f of analysis.flags) if (f.fix) map.set(f.fix.id, f.fix);
    return map;
  }, [analysis]);

  const doneDelta = [...fixesById.values()]
    .filter((f) => doneFixes.includes(f.id))
    .reduce((s, f) => s + f.scoreDelta, 0);
  const score = Math.min(100, analysis.score + doneDelta);

  const isDone = (flag: AnalysisFlag) => !!flag.fix && doneFixes.includes(flag.fix.id);
  const attentionRemaining = analysis.flags.filter((f) => !isDone(f)).length;
  const attentionText =
    attentionRemaining === 0
      ? "You're on top of it."
      : `${attentionRemaining} thing${attentionRemaining > 1 ? "s" : ""} need${
          attentionRemaining > 1 ? "" : "s"
        } your attention`;

  // gold heartbeat on the health card whenever a fix lands
  const doneCount = doneFixes.length;
  const prevCount = useRef(doneCount);
  useEffect(() => {
    if (doneCount > prevCount.current) {
      setPulse(false);
      const raf = requestAnimationFrame(() => setPulse(true));
      const timer = setTimeout(() => setPulse(false), 1500);
      prevCount.current = doneCount;
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
    prevCount.current = doneCount;
  }, [doneCount]);

  const openFix = openFixId ? fixesById.get(openFixId) ?? null : null;
  const projected = openFix
    ? Math.min(100, score + (doneFixes.includes(openFix.id) ? 0 : openFix.scoreDelta))
    : score;

  return (
    <div>
      <Header />

      {/* portfolio strip — floats on the base, no container */}
      <Reveal className="px-5 pb-6 pt-7">
        <AnimatedNumber
          value={analysis.summary.totalValue}
          format={(n) => formatINR(n)}
          className="block text-display font-extrabold text-primary"
        />
        <p className="mt-2 text-[15px]">
          <AnimatedNumber
            value={analysis.summary.returnsPct}
            format={(n) => formatPercent(n)}
            className={cn("font-bold", analysis.summary.returnsPct >= 0 ? "text-teal" : "text-red")}
          />
          <span className="text-muted">{"   "}</span>
          <AnimatedNumber
            value={analysis.summary.returnsAbs}
            format={(n) => formatINR(n, { signed: true })}
            className={cn("font-bold", analysis.summary.returnsAbs >= 0 ? "text-teal" : "text-red")}
          />
        </p>
        <p className="mt-1 text-[13px] text-muted">
          Invested {formatINR(analysis.summary.invested)}
          {sourceLabels[analysis.source] ? ` · ${sourceLabels[analysis.source]}` : ""}
        </p>
      </Reveal>

      <div className="space-y-7 px-5">
        {/* health score */}
        <Reveal index={1}>
          <Card className={cn("flex items-center gap-4", pulse && "animate-gold-pulse")}>
            <HealthRing score={score} />
            <div className="min-w-0">
              <p className="text-[18px] font-semibold text-primary">
                {scoreLabelFor(score, analysis.scoreLabel)}
              </p>
              <p className={cn("mt-0.5 text-[14px]", attentionRemaining === 0 ? "text-teal" : "text-muted")}>
                {attentionText}
              </p>
            </div>
          </Card>
          {analysis.note && <p className="mt-2 text-[11px] text-muted">{analysis.note}</p>}
        </Reveal>

        {/* the score gets a pulse — renders only once there's history */}
        <Reveal index={2}>
          <ScoreTrend score={score} />
        </Reveal>

        {/* the truth */}
        {analysis.flags.length > 0 && (
          <section>
            <Reveal index={2}>
              <h2 className="mb-3 text-heading text-primary">Here&apos;s the truth</h2>
            </Reveal>
            <div className="space-y-3">
              {analysis.flags.map((flag, i) => (
                <Reveal key={flag.id} index={3 + i}>
                  <InsightCard
                    tone={flag.severity}
                    label={flag.label}
                    done={isDone(flag)}
                    actionText={flag.fix ? "How to fix this" : undefined}
                    onAction={flag.fix ? () => setOpenFixId(flag.fix!.id) : undefined}
                  >
                    {flag.body}
                  </InsightCard>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* what's working */}
        {analysis.working.length > 0 && (
          <section>
            <Reveal index={6}>
              <h2 className="mb-3 text-heading text-primary">What&apos;s working</h2>
            </Reveal>
            <div className="space-y-3">
              {analysis.working.map((w, i) => (
                <Reveal key={w.id} index={7 + i}>
                  <InsightCard tone="teal" label={w.label}>
                    {w.body}
                  </InsightCard>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* your move */}
        {analysis.moves.length > 0 && (
          <section>
            <Reveal index={9}>
              <h2 className="mb-3 text-heading text-primary">Your move</h2>
            </Reveal>
            <Reveal index={10}>
              <div className="space-y-4">
                {analysis.moves.map((move, i) => {
                  const d = doneFixes.includes(move.fixId);
                  return (
                    <div key={move.fixId} className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold tabular",
                          d ? "bg-teal-dim text-teal" : "bg-gold-dim text-gold"
                        )}
                      >
                        {d ? <Check size={13} strokeWidth={3} /> : i + 1}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-[15px] font-medium leading-snug",
                            d ? "text-secondary" : "text-primary"
                          )}
                        >
                          {move.title}
                        </p>
                        {d ? (
                          <span className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-teal">
                            <Check size={12} strokeWidth={3} />
                            Done
                          </span>
                        ) : (
                          <button
                            onClick={() => setOpenFixId(move.fixId)}
                            className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-gold"
                          >
                            {move.cta}
                            <ArrowRight size={13} strokeWidth={2.6} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Reveal>
          </section>
        )}

        {/* the pre-buy gut check — the tool you come back for */}
        {analysis.source !== "demo" && (
          <Reveal index={11}>
            <TipCheck analysis={analysis} />
          </Reveal>
        )}

        {/* the one community door — not a feed */}
        <Reveal index={12}>
          <Card className="border-l-[3px] border-purple">
            <p className="text-[14px] leading-[1.5] text-secondary">
              <span className="font-semibold text-primary">Tribes are coming</span> — compare notes
              with investors on the same thesis, not influencers with a course to sell.
            </p>
            <Link
              href="/tribes"
              className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-gold"
            >
              Peek at the tribes
              <ArrowRight size={14} strokeWidth={2.6} />
            </Link>
          </Card>
        </Reveal>

        {/* replay / analyze a fresh portfolio */}
        <Reveal index={13}>
          <button
            onClick={reset}
            className="mx-auto flex items-center gap-1.5 pb-2 text-[12px] text-muted"
          >
            <RotateCcw size={12} />
            Scan a different portfolio
          </button>
        </Reveal>
      </div>

      {/* the AI assistant */}
      <AskAnts analysis={analysis} />

      {/* fix detail sheet */}
      <AnimatePresence>
        {openFix && (
          <FixSheet
            key={openFix.id}
            fix={openFix}
            currentScore={score}
            projectedScore={projected}
            done={doneFixes.includes(openFix.id)}
            onClose={() => setOpenFixId(null)}
            onMarkDone={(id) => {
              markFixDone(id);
              setOpenFixId(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
