"use client";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { useAppState } from "@/components/app/AppState";
import { getXpProgressInLevel, getLevelBandName } from "@/lib/gamification/xpSystem";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Card } from "@/components/ui/Card";

const BAND_EMBLEM: Record<string, string> = {
  Rookie: "🐜",
  Apprentice: "🌱",
  Analyst: "📊",
  Pro: "🎯",
  Master: "💎",
  Whale: "🐋",
};

/**
 * Level progress — XP is a milestone currency, so the bar is a gold gradient
 * with a shimmer sweep. A band emblem gives level identity beyond text, and
 * the streak is promoted to a chip — the app's strongest retention asset
 * shouldn't be a muted afterthought.
 */
export function LevelProgress() {
  const { gamification } = useAppState();
  const { current, needed, percent } = getXpProgressInLevel(gamification.totalXpEarned);
  const levelName = getLevelBandName(gamification.level);
  const streak = gamification.dailyStreak.current;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-dim text-[20px]">
            {BAND_EMBLEM[levelName] ?? "🐜"}
          </span>
          <div>
            <p className="text-label uppercase text-muted">Level {gamification.level}</p>
            <p className="mt-0.5 text-[16px] font-semibold text-primary">{levelName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {streak > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-gold-dim px-2 py-1">
              <Flame size={12} strokeWidth={2.6} className="animate-flicker text-gold" fill="currentColor" />
              <span className="text-[12px] font-extrabold text-gold tabular">{streak}</span>
            </span>
          )}
          <p className="text-[13px] text-muted">
            <AnimatedNumber
              value={current}
              format={(n) => Math.round(n).toString()}
              className="text-[17px] font-extrabold text-gold"
            />{" "}
            / {needed}
          </p>
        </div>
      </div>

      <div className="progress-shine mt-3 h-2.5 overflow-hidden rounded-full bg-elevated">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22, delay: 0.2 }}
          className="h-full rounded-full fill-gold-gradient shadow-glow-gold"
        />
      </div>

      {streak > 0 && gamification.dailyStreak.longest > streak && (
        <p className="mt-2 text-[11px] text-muted">longest streak {gamification.dailyStreak.longest} days</p>
      )}
    </Card>
  );
}
