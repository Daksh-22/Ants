"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Check, PenLine, RotateCcw } from "lucide-react";
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
import { DailyCheckInPrompt } from "@/components/gamification/DailyCheckInPrompt";
import { DailyMissions } from "@/components/gamification/DailyMissions";
import { LevelProgress } from "@/components/gamification/LevelProgress";
import { XP_REWARDS } from "@/lib/gamification/xpSystem";
import { recordActivity } from "@/lib/gamification/dailyActivity";

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
import { DemoBanner } from "@/components/ui/DemoBanner";
import { describeFreshness } from "@/lib/utils/freshness";

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
  const pressable = !done && !!actionText && !!onAction;
  return (
    <Card
      pressable={pressable}
      onClick={pressable ? onAction : undefined}
      className={cn("border-l-[3px]", accent[t].border, pressable && "cursor-pointer")}
    >
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
      ) : pressable ? (
        <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-gold">
          {actionText}
          <ArrowRight size={13} strokeWidth={2.6} />
        </span>
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
  const {
    analysis: stored,
    isDemo,
    doneFixes,
    markFixDone,
    unmarkFixDone,
    reset,
    earnXp,
    gamification,
    unlockAchievement,
  } = useAppState();
  const analysis = stored ?? DEFAULT_ANALYSIS;

  const [openFixId, setOpenFixId] = useState<string | null>(null);

  // ?fix=<id> opens that fix directly, so "Fix it on Home" from /portfolio
  // lands on the sheet instead of the top of the page.
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const wanted = searchParams.get("fix");
    if (!wanted) return;
    setOpenFixId(wanted);
    router.replace("/home");
  }, [searchParams, router]);
  const [pulse, setPulse] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // True only for the very first results render of a session, so the daily
  // check-in sheet doesn't land on top of the answer the user just waited for.
  const [isFirstResult] = useState(() => {
    try {
      const seen = localStorage.getItem("ants:seen-results");
      if (!seen) {
        localStorage.setItem("ants:seen-results", "1");
        return true;
      }
    } catch {
      // localStorage unavailable — treat as a returning user
    }
    return false;
  });

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

  // milestone sweep — unlockAchievement is idempotent, so re-checking is free
  const streak = gamification.dailyStreak.current;
  useEffect(() => {
    unlockAchievement("first_scan");
    if (score >= 80) unlockAchievement("strong_portfolio");
    if (analysis.holdings.length >= 10) unlockAchievement("diversifier");
    if (new Set(analysis.holdings.map((h) => h.sector)).size >= 5)
      unlockAchievement("diversified_investor");
    if (doneFixes.length >= 5) unlockAchievement("problem_solver_5");
    if (doneFixes.length >= 20) unlockAchievement("portfolio_surgeon_20");
    if (streak >= 10) unlockAchievement("habit_former_10");
    if (streak >= 50) unlockAchievement("discipline_master_50");
    if (streak >= 100) unlockAchievement("century_club");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, doneFixes.length, analysis, streak]);

  const openFix = openFixId ? fixesById.get(openFixId) ?? null : null;
  const projected = openFix
    ? Math.min(100, score + (doneFixes.includes(openFix.id) ? 0 : openFix.scoreDelta))
    : score;

  return (
    <div>
      <Header />
      {/* Suppressed on the first-ever result. lastCheckInDate seeds to the
          epoch, so this prompt was always "due" for a new user: they sat
          through the processing script, the results faded in, and a
          full-screen sheet immediately slid over them asking about a streak
          they didn't have yet. */}
      {!isFirstResult && <DailyCheckInPrompt />}

      {isDemo && <DemoBanner className="mx-5 mt-4" />}

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
        {analysis.pricing && analysis.pricing.total > 0 && (
          analysis.pricing.note ? (
            <p className="mt-1.5 text-[11px] leading-snug text-amber">{analysis.pricing.note}</p>
          ) : (
            (() => {
              // Only claim "live" when the quotes actually are. Anything older
              // gets an explicit age and a muted dot instead of a teal one.
              const { label, stale } = describeFreshness(analysis.pricing.pricedAt);
              return (
                <p
                  className={cn(
                    "mt-1.5 flex items-center gap-1.5 text-[11px]",
                    stale ? "text-muted" : "text-teal"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      stale ? "bg-muted" : "bg-teal"
                    )}
                  />
                  {label} · all {analysis.pricing.total} holdings
                  {stale && (
                    <Link href="/home?edit=1" className="font-semibold text-gold underline underline-offset-2">
                      Refresh
                    </Link>
                  )}
                </p>
              );
            })()
          )
        )}
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
          {analysis.flags.length > 0 && (
            <div className="mt-2.5 flex gap-1">
              {analysis.flags.map((flag, i) => (
                <motion.span
                  key={flag.id}
                  initial={false}
                  animate={{
                    backgroundColor: isDone(flag) ? "var(--accent-teal)" : "var(--accent-amber)",
                    opacity: isDone(flag) ? 1 : [0.5, 0.85, 0.5],
                  }}
                  transition={
                    isDone(flag)
                      ? { duration: 0.4, delay: i * 0.05 }
                      : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                  }
                  className="h-1 flex-1 rounded-full"
                />
              ))}
            </div>
          )}
          {analysis.note && <p className="mt-2 text-[11px] text-muted">{analysis.note}</p>}
        </Reveal>

        {/* the score gets a pulse — renders only once there's history */}
        <Reveal index={2}>
          <ScoreTrend score={score} />
        </Reveal>

        {/* level progress + today's missions */}
        <Reveal index={3}>
          <LevelProgress />
        </Reveal>
        <Reveal index={4}>
          <DailyMissions />
        </Reveal>

        {/* the truth */}
        {analysis.flags.length > 0 && (
          <section>
            <Reveal index={4}>
              <h2 className="mb-3 text-heading text-primary">Here&apos;s the truth</h2>
            </Reveal>
            <div className="space-y-3">
              {analysis.flags.map((flag, i) => (
                <Reveal key={flag.id} index={5 + i}>
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
            <Reveal index={7}>
              <h2 className="mb-3 text-heading text-primary">What&apos;s working</h2>
            </Reveal>
            <div className="space-y-3">
              {analysis.working.map((w, i) => (
                <Reveal key={w.id} index={8 + i}>
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
            <Reveal index={10}>
              <h2 className="mb-3 text-heading text-primary">Your move</h2>
            </Reveal>
            <Reveal index={11}>
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
          <Reveal index={12}>
            <TipCheck analysis={analysis} />
          </Reveal>
        )}

        {/* Edit is the common case — correcting a quantity shouldn't cost the
            whole portfolio and the score trend. Kept visually distinct from
            the destructive reset below it. */}
        <Reveal index={13}>
          <Link
            href="/home?edit=1"
            className="mx-auto mb-3 flex w-fit items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-[13px] font-semibold text-secondary transition-colors hover:bg-elevated"
          >
            <PenLine size={13} strokeWidth={2.5} />
            Edit my holdings
          </Link>
        </Reveal>

        {/* replay / analyze a fresh portfolio — two-tap so progress is never lost by accident */}
        <Reveal index={14}>
          <button
            onClick={() => (confirmReset ? reset() : setConfirmReset(true))}
            onBlur={() => setConfirmReset(false)}
            className={cn(
              "mx-auto flex items-center gap-1.5 pb-2 text-[12px]",
              confirmReset ? "font-semibold text-amber" : "text-muted"
            )}
          >
            <RotateCcw size={12} />
            {confirmReset ? "Tap again to clear this breakdown" : "Scan a different portfolio"}
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
            onUnmarkDone={unmarkFixDone}
            onMarkDone={(id) => {
              markFixDone(id);
              earnXp(XP_REWARDS.FIX_COMPLETED, "Fix completed");
              recordActivity("fix");
              setOpenFixId(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
