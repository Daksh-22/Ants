"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Reveal } from "@/components/ui/Reveal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { useAppState } from "@/components/app/AppState";
import type { Analysis } from "@/lib/analysis/types";
import { NoPortfolio } from "@/components/ui/NoPortfolio";
import { chatCount, recordBenchmarkDay } from "@/lib/gamification/lifetimeCounters";
import { RiskDashboard } from "@/components/insights/RiskDashboard";
import { BenchmarkComparison } from "@/components/insights/BenchmarkComparison";
import { SectorHeatMap, SectorPerformance } from "@/components/insights/SectorHeatMap";
import { SmartWatchlist } from "@/components/insights/SmartWatchlist";
import { InsightsFeed } from "@/components/insights/InsightsFeed";
import { PriceAlerts } from "@/components/insights/PriceAlerts";
import type {
  RiskMetrics,
  BenchmarkComparison as BenchmarkComparisonType,
  HoldingVolatility,
} from "@/lib/insights/types";
import {
  fetchBenchmarks,
  fetchRiskMetrics,
  type BenchmarksReply,
  type RiskReply,
} from "@/lib/api/portfolio";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { XP_REWARDS } from "@/lib/gamification/xpSystem";
import { formatPercent } from "@/lib/utils/formatPercent";
import { formatINR } from "@/lib/utils/formatINR";
import { cn } from "@/lib/utils/cn";

const INSIGHTS_VISIT_KEY = "ants:insights-last-visit";

// Index returns come from GET /api/benchmarks (live, Yahoo-sourced, cached 1h).
// They were hardcoded here as { nifty50: 8.5, sensex: 7.2, microCap: 12.3 } —
// wrong by enough to invert the conclusion, since the Nifty's actual trailing
// year was negative. When the fetch fails we hide the comparison rather than
// fall back to a number we made up.

/** Inline "this section couldn't load" with a retry, instead of a bare heading. */
/**
 * `onRetry` is optional: a data-coverage limit ("not enough price history") is
 * not something retrying fixes, and offering Retry on it invites the user to
 * hammer a button that will never succeed.
 */
function SectionError({ label, onRetry }: { label: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-subtle bg-surface px-4 py-3.5">
      <p className="text-[13px] leading-snug text-muted">{label}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 text-[13px] font-semibold text-gold underline underline-offset-4"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div>
      <Header />
      <div className="px-5 pb-6 pt-7">
        <div className="shimmer h-3 w-28 rounded-full" />
        <div className="shimmer mt-2 h-10 w-40 rounded-xl" />
        <div className="shimmer mt-2 h-3 w-52 rounded-full" />
      </div>
      <div className="space-y-4 px-5">
        {[132, 220, 260].map((h, i) => (
          <div key={i} className="shimmer rounded-2xl" style={{ height: h }} />
        ))}
      </div>
    </div>
  );
}

/**
 * /insights — the analytics floor. Risk profile, benchmark comparison and the
 * sector heat map, all computed from the user's real analysis. There is no demo
 * fallback: with no portfolio this route renders NoPortfolio instead.
 * First visit each day earns XP — exploring your own risk is a habit worth paying.
 */
/**
 * Gate, then render. The content component below reads `analysis` inside hooks,
 * so the "no portfolio" check cannot be an early return in there — it would make
 * the hook order conditional. Splitting keeps hooks unconditional and lets the
 * empty state be strict: this page used to fall back to DEFAULT_ANALYSIS and
 * render the built-in demo book's risk and benchmarks as the user's own.
 */
export default function InsightsPage() {
  const { analysis: stored, hydrated } = useAppState();
  if (!hydrated) return <InsightsSkeleton />;
  if (!stored) return <NoPortfolio what="your risk and benchmark comparison" />;
  return <InsightsContent analysis={stored} />;
}

function InsightsContent({ analysis }: { analysis: Analysis }) {
  const { hydrated, earnXp, isDemo, unlockAchievement } = useAppState();

  // Real risk, computed server-side from a year of daily closes. This used to
  // be a client-side sector→volatility lookup with invented coefficients
  // (`* 0.8`, `-vol * 2.5`, `0.85 * vol / 16.5`), and its table was missing 10
  // of the 22 sector labels the backend emits — so most holdings silently took
  // a 22% default and every number here barely moved between portfolios.
  const [riskReply, setRiskReply] = useState<RiskReply | null>(null);
  // Keep the REASON, not just a boolean. The backend supplies specific notes
  // ("Live index data is unavailable right now") and the API client turns an
  // unset NEXT_PUBLIC_API_URL into a message naming that variable — all of which
  // was discarded in favour of a hardcoded "Couldn't measure risk right now.",
  // so a misconfigured deployment showed two vague retry rows that could never
  // succeed instead of the one sentence that explains why.
  const [riskFailed, setRiskFailed] = useState<string | null>(null);
  const [benchFailed, setBenchFailed] = useState<string | null>(null);
  // bumped to re-run both fetches from the inline Retry rows
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const positions = analysis.holdings.map((h) => ({
      ticker: h.ticker,
      qty: h.qty,
      avg: h.avg,
    }));
    if (positions.length === 0) return;
    let alive = true;
    setRiskFailed(null);
    fetchRiskMetrics(positions)
      .then((r) => {
        if (alive) setRiskReply(r);
      })
      .catch((err: unknown) => {
        // Never substitute a guess — but don't collapse to a bare heading
        // either, and don't throw away what went wrong.
        if (alive) {
          setRiskFailed(
            err instanceof Error && err.message
              ? err.message
              : "Couldn't measure risk right now."
          );
        }
      });
    return () => {
      alive = false;
    };
  }, [analysis, reloadKey]);

  // beta_vs_nifty stays null when it could not be measured. Rewriting it to 0
  // claimed a portfolio perfectly uncorrelated with the market — a specific,
  // false, and reassuring number — right next to copy about how market swings
  // will hit it. Every other unavailable figure on this page is hidden.
  const riskMetrics: RiskMetrics | null = riskReply?.risk ?? null;
  const holdingVolatilities: HoldingVolatility[] = (riskReply?.holdingVolatilities ?? [])
    .slice()
    .sort((a, b) => b.contribution_to_portfolio_risk - a.contribution_to_portfolio_risk);

  // Live index returns. Hidden entirely when unavailable — never replaced with
  // a placeholder, which is how a hardcoded +8.5% Nifty shipped against an
  // actual -0.46%.
  const [indexes, setIndexes] = useState<BenchmarksReply["indexes"] | null>(null);
  useEffect(() => {
    let alive = true;
    setBenchFailed(null);
    fetchBenchmarks()
      .then((r) => {
        if (alive) {
          if (r.available) setIndexes(r.indexes);
          // r.note is the backend's own explanation — use it over a guess.
          else setBenchFailed(r.note || "Couldn't load index returns right now.");
        }
      })
      .catch((err: unknown) => {
        if (alive) {
          setBenchFailed(
            err instanceof Error && err.message
              ? err.message
              : "Couldn't load index returns right now."
          );
        }
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const nifty = indexes?.nifty50?.returnPct ?? null;

  const benchmarks: BenchmarkComparisonType | null = useMemo(() => {
    if (!indexes) return null;
    const n = indexes.nifty50?.returnPct;
    const sx = indexes.sensex?.returnPct;
    const m = indexes.midCap?.returnPct;
    if (n === undefined || sx === undefined || m === undefined) return null;
    const mine = analysis.summary.returnsPct;
    return {
      user_return_pct: mine,
      nifty50_return_pct: n,
      sensex_return_pct: sx,
      nifty_midcap_return_pct: m,
      outperformance: {
        vs_nifty50: mine - n,
        vs_sensex: mine - sx,
        vs_nifty_midcap: mine - m,
      },
      // Ranking against peers needs a real cohort of real users.
      rank_percentile: null,
    };
  }, [analysis, indexes]);

  /**
   * Record whether the portfolio is ahead of the Nifty today, and unlock the two
   * badges whose counters previously existed nowhere.
   *
   * Gated on a real, non-demo comparison: crediting a "beat the index" day off
   * the demo portfolio's numbers would be awarding progress for someone else's
   * returns. isDemo covers the fallback case too.
   */
  useEffect(() => {
    if (!hydrated || isDemo || !benchmarks) return;
    const days = recordBenchmarkDay(benchmarks.outperformance.vs_nifty50 > 0);
    if (days >= 30) unlockAchievement("benchmark_beater");
    if (chatCount() >= 10) unlockAchievement("ask_ants_master");
  }, [hydrated, isDemo, benchmarks, unlockAchievement]);

  // first insights visit each day earns XP — same one-shot pattern as check-in
  useEffect(() => {
    if (!hydrated) return;
    try {
      const today = new Date().toDateString();
      if (localStorage.getItem(INSIGHTS_VISIT_KEY) !== today) {
        localStorage.setItem(INSIGHTS_VISIT_KEY, today);
        earnXp(XP_REWARDS.MISSION_CHECK_RISK_METRICS, "Checked your risk");
      }
    } catch {
      // localStorage unavailable — skip the reward, keep the page working
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // One source of truth for "this isn't the user's data": either AppState
  // flagged it, or the analysis itself says so. These were separate checks on
  // separate pages and could disagree.
  const isDemoView = isDemo || analysis.source === "demo";

  if (!hydrated) return <InsightsSkeleton />;

  // null until the live index fetch lands (or forever, if it fails)
  const vsNifty = benchmarks?.outperformance.vs_nifty50 ?? null;

  return (
    <div>
      <Header />

      {isDemoView && (
        <div className="px-5 pt-5">
          <DemoBanner />
        </div>
      )}

      {/* hero — how you're doing vs the market. Renders your own return until
          the live index lands; never invents an index number to compare to. */}
      <Reveal className="relative px-5 pb-6 pt-7">
        <div
          className={cn(
            "pointer-events-none absolute left-5 top-2 h-32 w-32 rounded-full blur-3xl",
            (vsNifty ?? analysis.summary.returnsPct) >= 0 ? "bg-teal/15" : "bg-red/15"
          )}
        />
        <p className="relative text-label uppercase text-muted">
          {vsNifty === null ? "Your return" : "You vs Nifty 50"}
        </p>
        <AnimatedNumber
          value={vsNifty ?? analysis.summary.returnsPct}
          format={(n) => formatPercent(n)}
          className={cn(
            "relative mt-1 block text-display font-extrabold",
            (vsNifty ?? analysis.summary.returnsPct) >= 0 ? "text-teal" : "text-red"
          )}
        />
        <p className="relative mt-1 text-[13px] text-muted">
          {vsNifty === null || nifty === null ? (
            <>
              {formatPercent(analysis.summary.returnsPct)} on{" "}
              {formatINR(analysis.summary.invested)} invested. Index comparison
              unavailable right now.
            </>
          ) : (
            <>
              Your {formatPercent(analysis.summary.returnsPct)} on{" "}
              {formatINR(analysis.summary.invested)} invested, against the
              index&apos;s {formatPercent(nifty)}
            </>
          )}
        </p>
      </Reveal>

      <div className="space-y-7 px-5">
        {/* sector heat map — where the money actually sits */}
        <section>
          <Reveal index={1}>
            <h2 className="mb-3 text-heading text-primary">Where your money sits</h2>
          </Reveal>
          <Reveal index={2}>
            <SectorHeatMap holdings={analysis.holdings} />
          </Reveal>
        </section>

        {/* Risk profile — rendered only once the real numbers land. It used to
            render immediately off client-side guesses, so the card was always
            populated and always roughly the same. */}
        {/* riskReply?.note covers the HTTP-200-but-unmeasurable case: risk null
            with "Not enough price history to measure risk for these holdings."
            riskFailed was false there, so the entire section — heading included
            — silently vanished, reading as a missing feature rather than a data
            limit on a portfolio of recent listings. */}
        {(riskMetrics || riskFailed || riskReply?.note) && (
          <section>
            <Reveal index={3}>
              <h2 className="mb-3 text-heading text-primary">Risk profile</h2>
              {riskReply && riskReply.coveragePct < 99 && (
                <p className="-mt-2 mb-3 text-[12px] text-muted">
                  Based on {Math.round(riskReply.coveragePct)}% of your portfolio
                  — the rest doesn&apos;t have enough price history yet.
                </p>
              )}
            </Reveal>
            {riskMetrics ? (
              <RiskDashboard
                riskMetrics={riskMetrics}
                holdingVolatilities={holdingVolatilities}
                index={4}
              />
            ) : riskFailed ? (
              <SectionError label={riskFailed} onRetry={() => setReloadKey((k) => k + 1)} />
            ) : (
              // Reached the server fine; it just can't measure this book. No
              // Retry — more attempts won't create price history.
              <SectionError label={riskReply?.note ?? "Couldn't measure risk right now."} />
            )}
          </section>
        )}

        {/* benchmarks */}
        <section>
          <Reveal index={4}>
            <h2 className="mb-3 text-heading text-primary">How you compare</h2>
          </Reveal>
          {benchmarks ? (
            <BenchmarkComparison benchmarks={benchmarks} index={6} />
          ) : benchFailed ? (
            <SectionError label={benchFailed} onRetry={() => setReloadKey((k) => k + 1)} />
          ) : null}
        </section>

        {/* watchlist — research before the money moves */}
        <section>
          <Reveal index={5}>
            <h2 className="mb-3 text-heading text-primary">Thinking of buying?</h2>
          </Reveal>
          <Reveal index={6}>
            <SmartWatchlist analysis={analysis} />
          </Reveal>
        </section>

        {/* price alerts — decide exits in daylight */}
        <section>
          <Reveal index={7}>
            <PriceAlerts analysis={analysis} />
          </Reveal>
        </section>

        {/* market insights ranked by holdings */}
        <section>
          <Reveal index={8}>
            <InsightsFeed analysis={analysis} />
          </Reveal>
        </section>

        {/* sector table */}
        <section className="pb-4">
          <Reveal index={9}>
            <SectorPerformance holdings={analysis.holdings} />
          </Reveal>
          {analysis.note && <p className="mt-2 text-[11px] text-muted">{analysis.note}</p>}
        </section>
      </div>
    </div>
  );
}
