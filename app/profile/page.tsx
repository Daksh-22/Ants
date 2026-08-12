"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useAppState } from "@/components/app/AppState";
import { LevelProgress } from "@/components/gamification/LevelProgress";
import { AchievementCard } from "@/components/gamification/AchievementCard";
import { ACHIEVEMENT_DEFINITIONS, getProgressForAchievement } from "@/lib/gamification/achievements";
import { DEFAULT_ANALYSIS } from "@/lib/analysis/default";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { sips } from "@/lib/data/mock";
import { formatINR } from "@/lib/utils/formatINR";
import { formatPercent } from "@/lib/utils/formatPercent";
import { cn } from "@/lib/utils/cn";

// longest running SIP = the investing streak (demo mode only)
const streakMonths = Math.max(...sips.map((s) => s.months));

const STREAK_MILESTONES = [7, 30, 90, 180, 365];
function nextStreakMilestone(days: number): number {
  return STREAK_MILESTONES.find((m) => m > days) ?? STREAK_MILESTONES[STREAK_MILESTONES.length - 1];
}


/**
 * AppState reads localStorage in an effect, so the first paint always used
 * DEFAULT_ANALYSIS — every visit flashed a stranger's ₹1,04,019 portfolio,
 * demo holdings and the "Sample portfolio" banner before swapping to the real
 * numbers. /insights and /home already gated on `hydrated`; these two didn't.
 */
function PageSkeleton() {
  return (
    <div className="space-y-3 px-5 pt-7">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-surface" />
      <div className="h-24 animate-pulse rounded-2xl bg-surface" />
      <div className="h-16 animate-pulse rounded-2xl bg-surface" />
      <div className="h-16 animate-pulse rounded-2xl bg-surface" />
    </div>
  );
}

export default function ProfilePage() {
  const { analysis: stored, doneFixes, gamification, hydrated, isDemo } = useAppState();
  const analysis = stored ?? DEFAULT_ANALYSIS;

  // live score — same math as Results: base score + deltas from fixes marked done
  const doneDelta = analysis.flags
    .filter((f) => f.fix && doneFixes.includes(f.fix.id))
    .reduce((s, f) => s + f.fix!.scoreDelta, 0);
  const score = Math.min(100, analysis.score + doneDelta);

  // truth-checks count for real portfolios — how many times they've looked
  const [truthChecks, setTruthChecks] = useState(1);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ants:score-history");
      const entries = raw ? JSON.parse(raw) : null;
      if (Array.isArray(entries)) setTruthChecks(Math.max(1, entries.length));
    } catch {
      // unreadable history — stay at 1
    }
  }, []);

  const streak = gamification.dailyStreak.current;
  const milestone = nextStreakMilestone(streak);

  const stats = [
    { label: "Net worth", value: formatINR(analysis.summary.totalValue), className: "text-primary" },
    {
      label: "Returns",
      value: formatPercent(analysis.summary.returnsPct),
      className: analysis.summary.returnsPct >= 0 ? "text-teal" : "text-red",
    },
    { label: "Health score", value: `${score}/100`, className: "text-gold" },
  ];

  // One source of truth for "this isn't the user's data": either AppState
  // flagged it, or the analysis itself says so. These were separate checks on
  // separate pages and could disagree.
  const isDemoView = isDemo || analysis.source === "demo";

  if (!hydrated) return <PageSkeleton />;

  return (
    <div>
      <Header />
      <div className="px-5 pt-7">
      {isDemoView && <DemoBanner className="mb-4" />}

      {/* identity */}
      <Reveal>
        {/* There is no signed-in user — accounts aren't enabled. This block
            used to render "Arjun Mehta · @arjun_compounds · 24 · Bengaluru ·
            Zerodha" plus an "Aggressive investor" badge as the viewer's own
            identity and risk profile, for everyone, computed from nothing. */}
        <div className="flex items-center gap-4">
          <Avatar initials="🐜" color="gold" size={60} />
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold leading-tight text-primary">Your profile</h1>
            <p className="mt-0.5 text-[12px] text-muted">
              Stored on this device · no account needed
            </p>
          </div>
        </div>
      </Reveal>

      {/* hero — SIP streak in demo mode, truth checks on a real portfolio */}
      <Reveal index={1} className="mt-6">
        {isDemoView ? (
          <Card className="border-l-2 border-gold bg-gold-dim">
            <SectionLabel>Investing streak</SectionLabel>
            <div className="mt-1.5 flex items-baseline gap-2">
              <Flame className="self-center text-gold" size={30} strokeWidth={2.4} />
              <AnimatedNumber
                value={streakMonths}
                format={(n) => `${Math.round(n)}`}
                className="text-display font-extrabold text-primary"
              />
              <span className="text-[16px] font-semibold text-secondary">months straight</span>
            </div>
            <p className="mt-2 text-body text-secondary">
              Your money&apos;s been working while you sleep. Don&apos;t break it now.
            </p>
          </Card>
        ) : (
          <Card className="border-l-2 border-gold bg-gold-dim">
            <SectionLabel>Truth streak</SectionLabel>
            <div className="mt-1.5 flex items-baseline gap-2">
              <Flame className="self-center text-gold" size={30} strokeWidth={2.4} />
              <AnimatedNumber
                value={truthChecks}
                format={(n) => `${Math.round(n)}`}
                className="text-display font-extrabold text-primary"
              />
              <span className="text-[16px] font-semibold text-secondary">
                truth checks and counting
              </span>
            </div>
            <p className="mt-2 text-body text-secondary">
              Most people never look. You keep looking.
            </p>
          </Card>
        )}

        {streak > 0 && (
          <div className="mt-3 rounded-2xl bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-[12px] text-secondary">
                <span className="font-bold text-gold">{streak}</span> day check-in streak · longest{" "}
                {gamification.dailyStreak.longest}
              </p>
              <p className="text-[11px] text-muted">{milestone} days</p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full fill-gold-gradient"
                style={{ width: `${Math.min(100, (streak / milestone) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </Reveal>

      {/* quick stats */}
      <Reveal index={2} className="mt-4">
        <div className="grid grid-cols-3 gap-2.5">
          {stats.map((s) => (
            <Card key={s.label} className="p-3.5">
              <SectionLabel className="text-[10px]">{s.label}</SectionLabel>
              <p className={cn("mt-1 text-[15px] font-bold tabular", s.className)}>{s.value}</p>
            </Card>
          ))}
        </div>
      </Reveal>

      {/* progression — level, XP, badges */}
      <Reveal index={3} className="mt-6">
        <SectionLabel className="mb-2">Progression</SectionLabel>
        <LevelProgress />
      </Reveal>

      <Reveal index={4} className="mt-4">
        {(() => {
          const unlocked = gamification.achievements;
          const unlockedIds = new Set(unlocked.map((a) => a.id));
          // nearest locked badges, with live progress where it exists
          const locked = Object.values(ACHIEVEMENT_DEFINITIONS)
            .filter((d) => !unlockedIds.has(d.id))
            .slice(0, 3);
          return (
            <div className="space-y-2">
              {unlocked.map((a, i) => (
                <AchievementCard key={a.id} achievement={a} index={i} />
              ))}
              {locked.map((d, i) => (
                <AchievementCard
                  key={d.id}
                  achievement={d}
                  index={unlocked.length + i}
                  isLocked
                  progress={(() => {
                    const p = getProgressForAchievement(
                      d.id,
                      gamification.dailyStreak.current,
                      doneFixes.length
                    );
                    return { current: p.progress, max: p.maxProgress };
                  })()}
                />
              ))}
              {unlocked.length === 0 && (
                <p className="text-center text-[12px] text-muted">
                  Badges land as you show up. The first one&apos;s already loading.
                </p>
              )}
            </div>
          );
        })()}
      </Reveal>

      {/* An "Account" section used to sit here with four rows — "Your tribes:
          1 joined", "SIPs: 3 active", "Risk profile: Aggressive",
          "Notifications: On". None of them reflected any real state, nothing
          read them back, and there are no accounts on this deployment. Tapping
          them opened sheets listing specific mutual funds and monthly amounts
          the user had never entered. Removed rather than mocked. */}

      </div>
    </div>
  );
}
