"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { HealthRing } from "@/components/home/HealthRing";
import { FixSheet } from "@/components/home/FixSheet";
import { BASE_SCORE, FIXES, getFix } from "@/components/home/fixes";
import { useAppState } from "@/components/app/AppState";
import { portfolio } from "@/lib/data/mock";
import { formatINR } from "@/lib/utils/formatINR";
import { formatPercent } from "@/lib/utils/formatPercent";
import { cn } from "@/lib/utils/cn";

function healthLabel(score: number): string {
  if (score >= 90) return "You're crushing it.";
  if (score >= 80) return "Strong portfolio.";
  if (score >= 60) return "Decent start.";
  if (score >= 40) return "Needs work.";
  return "Let's fix this.";
}

type Tone = "red" | "amber" | "teal";
const accent: Record<Tone, { border: string; dot: string }> = {
  red: { border: "border-red", dot: "bg-red" },
  amber: { border: "border-amber", dot: "bg-amber" },
  teal: { border: "border-teal", dot: "bg-teal" },
};

function InsightCard({
  tone,
  label,
  children,
  fixId,
  actionText,
  done,
  onFix,
}: {
  tone: Tone;
  label: string;
  children: ReactNode;
  fixId?: string;
  actionText?: string;
  done?: boolean;
  onFix?: (id: string) => void;
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
      ) : actionText && fixId && onFix ? (
        <button
          onClick={() => onFix(fixId)}
          className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-gold"
        >
          {actionText}
          <ArrowRight size={13} strokeWidth={2.6} />
        </button>
      ) : null}
    </Card>
  );
}

const moves: { title: string; cta: string; fixId: string }[] = [
  { title: "Switch PGIM to Direct — saves ₹387/year", cta: "Do this", fixId: "pgim-direct" },
  { title: "Reduce HDFC + Reliance below 12%", cta: "See how", fixId: "concentration" },
  { title: "Add one international ETF", cta: "Explore", fixId: "international-etf" },
];

/**
 * STATE 2 — the new home after a portfolio is analyzed. A brutally honest,
 * personalized breakdown: score, the truth, what's working, and the next moves.
 * Every action opens a FixSheet; marking one done climbs the health ring,
 * flips its card to teal, and drops the attention count.
 */
export function Results() {
  const { doneFixes, markFixDone, reset } = useAppState();
  const [openFixId, setOpenFixId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);

  const score = Math.min(
    100,
    BASE_SCORE + FIXES.filter((f) => doneFixes.includes(f.id)).reduce((s, f) => s + f.scoreDelta, 0)
  );
  const attentionRemaining = FIXES.filter((f) => f.isAttentionItem && !doneFixes.includes(f.id)).length;
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

  const isDone = (id: string) => doneFixes.includes(id);
  const openFix = getFix(openFixId);

  return (
    <div>
      <Header />

      {/* portfolio strip — floats on the base, no container */}
      <Reveal className="px-5 pb-6 pt-7">
        <AnimatedNumber
          value={portfolio.totalValue}
          format={(n) => formatINR(n)}
          className="block text-display font-extrabold text-primary"
        />
        <p className="mt-2 text-[15px]">
          <AnimatedNumber
            value={portfolio.returnsPct}
            format={(n) => formatPercent(n)}
            className="font-bold text-teal"
          />
          <span className="text-muted">{"   "}</span>
          <AnimatedNumber
            value={portfolio.returnsAbs}
            format={(n) => formatINR(n, { signed: true })}
            className="font-bold text-teal"
          />
        </p>
        <p className="mt-1 text-[13px] text-muted">Invested {formatINR(portfolio.invested)}</p>
      </Reveal>

      <div className="space-y-7 px-5">
        {/* health score */}
        <Reveal index={1}>
          <Card className={cn("flex items-center gap-4", pulse && "animate-gold-pulse")}>
            <HealthRing score={score} />
            <div className="min-w-0">
              <p className="text-[18px] font-semibold text-primary">{healthLabel(score)}</p>
              <p className={cn("mt-0.5 text-[14px]", attentionRemaining === 0 ? "text-teal" : "text-muted")}>
                {attentionText}
              </p>
            </div>
          </Card>
        </Reveal>

        {/* the truth */}
        <section>
          <Reveal index={2}>
            <h2 className="mb-3 text-heading text-primary">Here&apos;s the truth</h2>
          </Reveal>
          <div className="space-y-3">
            <Reveal index={3}>
              <InsightCard
                tone="red"
                label="Concentration risk"
                fixId="concentration"
                actionText="How to fix this"
                done={isDone("concentration")}
                onFix={setOpenFixId}
              >
                You say AI infra. HDFC Bank and Reliance are 24% of your money. That&apos;s your
                dad&apos;s portfolio. Either change your thesis or change your holdings.
              </InsightCard>
            </Reveal>
            <Reveal index={4}>
              <InsightCard
                tone="red"
                label="PGIM is costing you money"
                fixId="pgim-direct"
                actionText="Switch to Direct"
                done={isDone("pgim-direct")}
                onFix={setOpenFixId}
              >
                You&apos;re on a regular plan. That&apos;s ₹387 a year going to a distributor who did
                nothing. Switching to Direct takes 4 minutes.
              </InsightCard>
            </Reveal>
            <Reveal index={5}>
              <InsightCard
                tone="amber"
                label="3 funds. 1.4 funds of stocks."
                fixId="overlap"
                actionText="Trim the overlap"
                done={isDone("overlap")}
                onFix={setOpenFixId}
              >
                Your Mirae Large Cap and Quant Small Cap share 31% of the same companies. You&apos;re
                not diversified. You&apos;re paying for repetition.
              </InsightCard>
            </Reveal>
          </div>
        </section>

        {/* what's working */}
        <section>
          <Reveal index={6}>
            <h2 className="mb-3 text-heading text-primary">What&apos;s working</h2>
          </Reveal>
          <div className="space-y-3">
            <Reveal index={7}>
              <InsightCard tone="teal" label="Your AI thesis is actually working">
                Dixon +40.6%. Kaynes +42.6%. These two alone added ₹18,400 to your portfolio. The
                thesis is right. The rest of your portfolio just hasn&apos;t caught up.
              </InsightCard>
            </Reveal>
            <Reveal index={8}>
              <InsightCard tone="teal" label="4 months of SIPs without missing">
                Top 22% of investors your age. Keep this going.
              </InsightCard>
            </Reveal>
          </div>
        </section>

        {/* your move */}
        <section>
          <Reveal index={9}>
            <h2 className="mb-3 text-heading text-primary">Your move</h2>
          </Reveal>
          <Reveal index={10}>
            <div className="space-y-4">
              {moves.map((move, i) => {
                const d = isDone(move.fixId);
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

        {/* the one community door — not a feed */}
        <Reveal index={11}>
          <Card className="border-l-[3px] border-purple">
            <p className="text-[14px] leading-[1.5] text-secondary">
              <span className="font-semibold text-primary">18,420 other investors</span> are holding
              similar AI infra positions.
            </p>
            <Link
              href="/tribes"
              className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-gold"
            >
              Join the AI Infrastructure tribe
              <ArrowRight size={14} strokeWidth={2.6} />
            </Link>
          </Card>
        </Reveal>

        {/* replay the demo / analyze a fresh screenshot */}
        <Reveal index={12}>
          <button
            onClick={reset}
            className="mx-auto flex items-center gap-1.5 pb-2 text-[12px] text-muted"
          >
            <RotateCcw size={12} />
            Scan a different portfolio
          </button>
        </Reveal>
      </div>

      {/* fix detail sheet */}
      <AnimatePresence>
        {openFix && (
          <FixSheet
            key={openFix.id}
            fix={openFix}
            doneFixes={doneFixes}
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
