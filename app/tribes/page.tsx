"use client";

import { Header } from "@/components/layout/Header";
import { Reveal } from "@/components/ui/Reveal";
import { Card } from "@/components/ui/Card";
import { Users } from "lucide-react";

/**
 * /tribes — NOT SHIPPED.
 *
 * The previous version read nothing from the user's analysis and presented
 * invented people as real ones:
 *
 *   - "18,420 ants · +31.4% avg this year" — constants
 *   - a leaderboard of three fabricated investors with handles, YTD returns
 *     and quoted investment commentary ("@sid_builds_wealth is up 67% this
 *     year", "Dixon was my highest conviction call. Still is.")
 *   - "You're #214 on the waitlist" — a hardcoded string; no waitlist exists
 *   - a "Conviction 8.4/10" meter for a metric with no definition
 *   - MirrorModal, which rendered a hardcoded basket under the header
 *     "Live Allocation" and offered to mirror it with a trailing stop-loss
 *
 * Attributing specific returns and opinions to named investors who do not
 * exist is not a placeholder — it is fabricated financial testimony, and it
 * sat one tap from a trade button. It ships as a placeholder until there are
 * real users with real, consented, verifiable holdings behind it.
 */
export default function TribesPage() {
  return (
    <div>
      <Header />
      <div className="px-5 pb-6 pt-7">
        <Reveal>
          <h1 className="text-display font-extrabold text-primary">Tribes</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-secondary">
            Not built yet.
          </p>
        </Reveal>

        <Reveal index={1}>
          <Card className="mt-6 p-5">
            <div className="flex items-start gap-3">
              <Users size={20} className="mt-0.5 shrink-0 text-muted" />
              <div>
                <p className="text-[14px] font-bold text-primary">
                  Real people, or nobody
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">
                  The point of tribes is comparing notes with investors on the
                  same thesis. That only works if they&apos;re real, and if
                  they chose to share. Invented profiles with invented returns
                  would be worse than an empty room.
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">
                  Until then, Tip Check is the honest version of the same
                  instinct: run what someone pitched you against your own book
                  before the money moves.
                </p>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
