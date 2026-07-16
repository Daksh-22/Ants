"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Users, Repeat, ShieldCheck, Bell, ChevronRight, X, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useAppState } from "@/components/app/AppState";
import { LevelProgress } from "@/components/gamification/LevelProgress";
import { AchievementCard } from "@/components/gamification/AchievementCard";
import { ACHIEVEMENT_DEFINITIONS, getProgressForAchievement } from "@/lib/gamification/achievements";
import { DEFAULT_ANALYSIS } from "@/lib/analysis/default";
import { user, sips, tribe } from "@/lib/data/mock";
import { formatINR } from "@/lib/utils/formatINR";
import { formatPercent } from "@/lib/utils/formatPercent";
import { cn } from "@/lib/utils/cn";

// longest running SIP = the investing streak (demo mode only)
const streakMonths = Math.max(...sips.map((s) => s.months));

const STREAK_MILESTONES = [7, 30, 90, 180, 365];
function nextStreakMilestone(days: number): number {
  return STREAK_MILESTONES.find((m) => m > days) ?? STREAK_MILESTONES[STREAK_MILESTONES.length - 1];
}

type RowKey = "tribes" | "sips" | "risk" | "notifications";

const rows: { key: RowKey; icon: LucideIcon; label: string; value: string }[] = [
  { key: "tribes", icon: Users, label: "Your tribes", value: "1 joined" },
  { key: "sips", icon: Repeat, label: "SIPs", value: `${sips.length} active` },
  { key: "risk", icon: ShieldCheck, label: "Risk profile", value: user.riskProfile },
  { key: "notifications", icon: Bell, label: "Notifications", value: "On" },
];

export default function ProfilePage() {
  const { analysis: stored, doneFixes, gamification } = useAppState();
  const analysis = stored ?? DEFAULT_ANALYSIS;
  const [openSheet, setOpenSheet] = useState<RowKey | null>(null);

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

  const isDemo = analysis.source === "demo";
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

  return (
    <div className="px-5 pt-7">
      {/* identity */}
      <Reveal>
        <div className="flex items-center gap-4">
          <Avatar initials={user.initials} color="gold" size={60} />
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold leading-tight text-primary">{user.name}</h1>
            <p className="text-[13px] font-semibold text-gold">{user.handle}</p>
            <p className="mt-0.5 text-[12px] text-muted">
              {user.age} · {user.city} · {user.broker}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <Badge tone="gold">Aggressive investor</Badge>
        </div>
      </Reveal>

      {/* hero — SIP streak in demo mode, truth checks on a real portfolio */}
      <Reveal index={1} className="mt-6">
        {isDemo ? (
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

      {/* settings-style rows */}
      <Reveal index={5} className="mt-6">
        <SectionLabel className="mb-2">Account</SectionLabel>
        <div className="space-y-2">
          {rows.map((row) => {
            const Icon = row.icon;
            if (row.key === "tribes") {
              return (
                <Link
                  key={row.key}
                  href="/tribes"
                  className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left transition-colors hover:bg-elevated"
                >
                  <Icon size={18} strokeWidth={2.2} className="text-gold" />
                  <span className="text-[15px] font-medium text-primary">{row.label}</span>
                  <span className="ml-auto text-[13px] text-secondary">{row.value}</span>
                  <ChevronRight size={16} className="text-muted" />
                </Link>
              );
            }
            return (
              <motion.button
                key={row.key}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => setOpenSheet(row.key)}
                className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left transition-colors hover:bg-elevated"
              >
                <Icon size={18} strokeWidth={2.2} className="text-gold" />
                <span className="text-[15px] font-medium text-primary">{row.label}</span>
                <span className="ml-auto text-[13px] text-secondary">{row.value}</span>
                <ChevronRight size={16} className="text-muted" />
              </motion.button>
            );
          })}
        </div>
      </Reveal>

      <Reveal index={6} className="mt-6">
        <p className="text-center text-[12px] text-muted">
          Member of {tribe.name} · {tribe.membershipMonths} months in
        </p>
      </Reveal>

      <AccountSheet
        openKey={openSheet}
        onClose={() => setOpenSheet(null)}
        sips={sips}
        riskProfile={user.riskProfile}
      />
    </div>
  );
}

function AccountSheet({
  openKey,
  onClose,
  sips: sipList,
  riskProfile,
}: {
  openKey: RowKey | null;
  onClose: () => void;
  sips: typeof sips;
  riskProfile: string;
}) {
  const titles: Record<RowKey, string> = {
    tribes: "Your tribes",
    sips: "Your SIPs",
    risk: "Risk profile",
    notifications: "Notifications",
  };

  return (
    <AnimatePresence>
      {openKey && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-app rounded-t-3xl bg-elevated px-6 pb-8 pt-3"
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-strong" />
            <div className="flex items-start justify-between">
              <h3 className="text-[18px] font-bold text-primary">{titles[openKey]}</h3>
              <button onClick={onClose} className="-m-1 p-1 text-muted">
                <X size={20} strokeWidth={2.4} />
              </button>
            </div>

            {openKey === "sips" && (
              <div className="mt-4 space-y-3">
                {sipList.map((sip) => (
                  <div key={sip.name} className="rounded-xl bg-surface p-3.5">
                    <p className="text-[14px] font-semibold text-primary">{sip.name}</p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {formatINR(sip.monthly)}/mo · {sip.months} months · {formatPercent(sip.returnPct)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {openKey === "risk" && (
              <p className="mt-4 text-[14px] leading-relaxed text-secondary">
                You&apos;re marked <span className="font-semibold text-gold">{riskProfile}</span>. This
                shapes which fixes and tips Ants surfaces — aggressive profiles see more upside language,
                conservative ones see more downside framing.
              </p>
            )}

            {openKey === "notifications" && (
              <p className="mt-4 text-[14px] leading-relaxed text-secondary">
                Daily check-in reminders and price alert triggers are on. Fine-grained controls are
                coming — for now it&apos;s all or nothing.
              </p>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
