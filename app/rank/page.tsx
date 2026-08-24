"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Reveal } from "@/components/ui/Reveal";
import { Card } from "@/components/ui/Card";
import { RankDot } from "@/components/ui/RankDot";
import { TrendingUp } from "lucide-react";
import { useAppState } from "@/components/app/AppState";
import { fetchRank, type RankReply } from "@/lib/api/portfolio";
import { cn } from "@/lib/utils/cn";

/**
 * /rank — a REAL cohort percentile, once one exists.
 *
 * Every /api/analyze call anonymously logs {returnsPct, totalValue} to
 * market_cohorts — no identity attached. This page asks the backend where
 * the CURRENT analysis's return sits against that real cohort.
 * database.Database.MIN_COHORT_SIZE gates the answer server-side: below that
 * many real samples, /api/rank returns available:false rather than a
 * percentile computed from a handful of other people. This page mirrors that
 * honesty — see the previous version's docstring for why a fabricated
 * cohort was pulled entirely rather than patched.
 */
export default function RankPage() {
  const { analysis, hydrated } = useAppState();
  const [rank, setRank] = useState<RankReply | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || !analysis) return;
    setLoading(true);
    setError(null);
    fetchRank(analysis.summary.returnsPct)
      .then(setRank)
      .catch(() => setError("Couldn't reach the ranking service. Try again in a moment."))
      .finally(() => setLoading(false));
  }, [hydrated, analysis]);

  if (!hydrated) return null;

  if (!analysis) {
    return (
      <div>
        <Header />
        <div className="px-5 pb-6 pt-7">
          <Reveal>
            <h1 className="text-display font-extrabold text-primary">Rank</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-secondary">
              Analyze your portfolio first — ranking compares it to others.
            </p>
          </Reveal>
        </div>
      </div>
    );
  }

  const notEnoughData = !loading && !error && rank && !rank.available;
  const topPct = rank?.available && rank.percentile !== undefined
    ? Math.max(1, Math.round(100 - rank.percentile))
    : null;

  return (
    <div>
      <Header />
      <div className="px-5 pb-6 pt-7">
        <Reveal>
          <h1 className="text-display font-extrabold text-primary">Rank</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-secondary">
            Where your {analysis.summary.returnsPct >= 0 ? "+" : ""}
            {analysis.summary.returnsPct.toFixed(1)}% sits against everyone else
            who&apos;s run a real analysis here.
          </p>
        </Reveal>

        {loading && (
          <Reveal index={1}>
            <Card className="mt-6 p-5">
              <p className="text-[13px] text-muted">Calculating your rank…</p>
            </Card>
          </Reveal>
        )}

        {error && (
          <Reveal index={1}>
            <Card className="mt-6 p-5">
              <p className="text-[13px] text-red">{error}</p>
            </Card>
          </Reveal>
        )}

        {notEnoughData && (
          <Reveal index={1}>
            <Card className="mt-6 p-5">
              <div className="flex items-start gap-3">
                <TrendingUp size={20} className="mt-0.5 shrink-0 text-muted" />
                <div>
                  <p className="text-[14px] font-bold text-primary">
                    Ranking needs a few more investors
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">
                    Only {rank?.sampleSize ?? 0} real portfolios have run through
                    Sift so far. We&apos;d rather show you nothing than a
                    percentile that isn&apos;t real yet.
                  </p>
                  <p className="mt-3 text-[13px] leading-relaxed text-muted">
                    In the meantime, Insights compares you to the Nifty 50 and
                    Sensex — those are real, live, and already yours.
                  </p>
                </div>
              </div>
            </Card>
          </Reveal>
        )}

        {rank?.available && rank.percentile !== undefined && topPct !== null && (
          <Reveal index={1}>
            <Card className="mt-6 p-6 text-center">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
                You&apos;re in the
              </p>
              <p className="mt-1 text-[44px] font-extrabold tabular text-gold">
                top {topPct}%
              </p>
              <p className="mt-1 text-[13px] text-secondary">
                of {rank.sampleSize} portfolios analyzed
              </p>

              <div className="mt-6 flex items-center justify-center gap-2">
                {Array.from({ length: 11 }, (_, i) => {
                  const bucket = i * 10; // 0, 10, 20, ..., 100
                  const isYou = Math.round(rank.percentile! / 10) === i;
                  return (
                    <RankDot
                      key={bucket}
                      index={i}
                      state={isYou ? "you" : bucket === 50 ? "returns" : "dim"}
                    />
                  );
                })}
              </div>
              <p className={cn("mt-3 text-[11px] text-muted")}>
                Lower percentile → higher percentile, left to right
              </p>
            </Card>
          </Reveal>
        )}
      </div>
    </div>
  );
}
