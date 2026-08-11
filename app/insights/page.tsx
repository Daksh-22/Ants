"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Reveal } from "@/components/ui/Reveal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { useAppState } from "@/components/app/AppState";
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
import { computeSectorMetrics } from "@/lib/insights/sectorMetrics";
import { fetchBenchmarks, type BenchmarksReply } from "@/lib/api/portfolio";
import { DEFAULT_ANALYSIS } from "@/lib/analysis/default";
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
 * sector heat map, all computed from the live analysis (demo fallback included).
 * First visit each day earns XP — exploring your own risk is a habit worth paying.
 */
export default function InsightsPage() {
  const { analysis: stored, hydrated, earnXp } = useAppState();
  const analysis = stored ?? DEFAULT_ANALYSIS;

  // risk metrics: sector-volatility model mirrored from backend/metrics.py
  const { riskMetrics, holdingVolatilities } = useMemo(() => {
    const sectors = computeSectorMetrics(analysis.holdings);

    // portfolio volatility: weight × sector vol, with a diversification haircut
    const volSquared = sectors.reduce(
      (sum, s) => sum + ((s.weight_pct / 100) * s.volatility_pct) ** 2,
      0
    );
    const volatility = Math.sqrt(volSquared) * 0.8 || 18;
    const sharpe = volatility > 0 ? (analysis.summary.returnsPct - 6) / volatility : 0;
    const sharpeScore = Math.max(0, Math.min(100, (sharpe + 1) * 33.33));
    const volScore = Math.max(0, Math.min(100, 100 - (volatility - 10) * 2.5));

    const metrics: RiskMetrics = {
      volatility_pct: Math.round(volatility * 10) / 10,
      sharpe_ratio: Math.round(sharpe * 100) / 100,
      max_drawdown_pct: Math.round(-volatility * 2.5 * 10) / 10,
      beta_vs_nifty: Math.round(((0.85 * volatility) / 16.5) * 100) / 100,
      risk_score: Math.round(sharpeScore * 0.6 + volScore * 0.4),
    };

    const vols: HoldingVolatility[] = analysis.holdings
      .map((h) => {
        const sectorVol = sectors.find((s) => s.sector === h.sector)?.volatility_pct ?? 22;
        return {
          ticker: h.ticker,
          sector: h.sector,
          volatility_pct: sectorVol,
          contribution_to_portfolio_risk: Math.round((h.weightPct / 100) * sectorVol * 10) / 10,
        };
      })
      .sort((a, b) => b.contribution_to_portfolio_risk - a.contribution_to_portfolio_risk);

    return { riskMetrics: metrics, holdingVolatilities: vols };
  }, [analysis]);

  const [indexes, setIndexes] = useState<BenchmarksReply["indexes"] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchBenchmarks()
      .then((r) => {
        if (alive && r.available) setIndexes(r.indexes);
      })
      .catch(() => {
        /* leave null — the comparison stays hidden rather than showing a guess */
      });
    return () => {
      alive = false;
    };
  }, []);

  const nifty = indexes?.nifty50?.returnPct ?? null;

  const benchmarks: BenchmarkComparisonType | null = useMemo(() => {
    if (!indexes) return null;
    const n = indexes.nifty50?.returnPct;
    const s = indexes.sensex?.returnPct;
    const m = indexes.midCap?.returnPct;
    if (n === undefined || s === undefined || m === undefined) return null;
    const mine = analysis.summary.returnsPct;
    return {
      user_return_pct: mine,
      nifty50_return_pct: n,
      sensex_return_pct: s,
      nifty_micro_cap_return_pct: m,
      outperformance: {
        vs_nifty50: mine - n,
        vs_sensex: mine - s,
        vs_nifty_micro_cap: mine - m,
      },
      // No percentile: ranking a user against peers needs a real cohort of
      // real users. This was pinned at 72 and rendered as a "Top 28%" trophy
      // for everyone.
      rank_percentile: null,
    };
  }, [analysis, indexes]);

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

  if (!hydrated) return <InsightsSkeleton />;

  // null until the live index fetch lands (or forever, if it fails)
  const vsNifty = benchmarks?.outperformance.vs_nifty50 ?? null;

  return (
    <div>
      <Header />

      {analysis.source === "demo" && (
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

        {/* risk profile */}
        <section>
          <Reveal index={3}>
            <h2 className="mb-3 text-heading text-primary">Risk profile</h2>
          </Reveal>
          <RiskDashboard
            riskMetrics={riskMetrics}
            holdingVolatilities={holdingVolatilities}
            index={4}
          />
        </section>

        {/* benchmarks */}
        <section>
          <Reveal index={5}>
            <h2 className="mb-3 text-heading text-primary">How you compare</h2>
          </Reveal>
          {benchmarks && <BenchmarkComparison benchmarks={benchmarks} index={6} />}
        </section>

        {/* watchlist — research before the money moves */}
        <section>
          <Reveal index={7}>
            <h2 className="mb-3 text-heading text-primary">Thinking of buying?</h2>
          </Reveal>
          <Reveal index={8}>
            <SmartWatchlist analysis={analysis} />
          </Reveal>
        </section>

        {/* price alerts — decide exits in daylight */}
        <section>
          <Reveal index={9}>
            <PriceAlerts analysis={analysis} />
          </Reveal>
        </section>

        {/* market insights ranked by holdings */}
        <section>
          <Reveal index={10}>
            <InsightsFeed analysis={analysis} />
          </Reveal>
        </section>

        {/* sector table */}
        <section className="pb-4">
          <Reveal index={7}>
            <SectorPerformance holdings={analysis.holdings} />
          </Reveal>
          {analysis.note && <p className="mt-2 text-[11px] text-muted">{analysis.note}</p>}
        </section>
      </div>
    </div>
  );
}
