"use client";

import { Header } from "@/components/layout/Header";
import { Reveal } from "@/components/ui/Reveal";
import { Card } from "@/components/ui/Card";
import { TrendingUp } from "lucide-react";

/**
 * /rank — NOT SHIPPED.
 *
 * The previous version of this page was fabricated end to end. It read
 * nothing from the user's analysis (zero references to AppState) and rendered
 * module-level constants from lib/data/mock.ts as personal, measured facts:
 *
 *   - a cohort ("Investors aged 22–27 · Bengaluru") that does not exist
 *   - a percentile ("Top 22%") pinned to a constant for every user
 *   - "↑ up 3% this month", a hardcoded string
 *   - an attribution breakdown ("SIP consistency +1.8%") that was invented
 *   - a "Climb faster" slider whose projections were arithmetic on that
 *     constant — the app's most interactive control, with a predetermined
 *     answer. This was the literal source of the user's complaint that
 *     nothing changes no matter what they do.
 *   - a share button that published "I'm in the top 22% of investors my age"
 *   - the line "Projection based on cohort data. Not a guarantee." — a
 *     disclaimer that asserts the existence of the data it disclaims.
 *
 * A percentile against other investors requires a real cohort of real users
 * with real holdings. Until that exists there is no honest version of this
 * screen, so it ships as an explicit placeholder rather than a plausible lie.
 */
export default function RankPage() {
  return (
    <div>
      <Header />
      <div className="px-5 pb-6 pt-7">
        <Reveal>
          <h1 className="text-display font-extrabold text-primary">Rank</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-secondary">
            Not built yet.
          </p>
        </Reveal>

        <Reveal index={1}>
          <Card className="mt-6 p-5">
            <div className="flex items-start gap-3">
              <TrendingUp size={20} className="mt-0.5 shrink-0 text-muted" />
              <div>
                <p className="text-[14px] font-bold text-primary">
                  Ranking needs other investors
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">
                  Comparing your portfolio to people your age only means
                  something once enough of them are actually here. We&apos;d
                  rather show you nothing than a number we made up.
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">
                  In the meantime, Insights compares you to the Nifty 50 and
                  Sensex — those are real, live, and already yours.
                </p>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
