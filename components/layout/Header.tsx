"use client";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { isNewDayForCheckIn, XP_REWARDS } from "@/lib/gamification/xpSystem";
import { useAppState } from "@/components/app/AppState";
import { getLevelBandName } from "@/lib/gamification/xpSystem";

/**
 * Home top bar: "Sift" gold wordmark, plus the two numbers that keep people
 * coming back — the streak flame and the level chip. Progression is always
 * in view; you never forget what you'd lose by not showing up.
 */
export function Header() {
  const { gamification, dailyCheckIn } = useAppState();
  const streak = gamification.dailyStreak.current;
  const level = gamification.level;

  // The check-in sheet was the ONLY entry point to dailyCheckIn(). Tapping
  // "Later" snoozed it for the session, after which the day's check-in was
  // unreachable — while the missions list could still offer "Check in" with a
  // +15 XP chip the user had no way to earn. This is the persistent route.
  const checkInDue = isNewDayForCheckIn(gamification.lastCheckInDate);

  return (
    <header className="flex items-center justify-between px-5 pt-5">
      <span className="text-[20px] font-extrabold tracking-tight text-gold">Sift</span>
      <div className="flex items-center gap-2">
        {checkInDue && (
          <button
            type="button"
            onClick={dailyCheckIn}
            className="flex items-center gap-1 rounded-full fill-gold-gradient px-2.5 py-1 text-[11px] font-extrabold text-ink"
          >
            <Flame size={12} strokeWidth={2.8} fill="currentColor" />
            Check in +{XP_REWARDS.DAILY_CHECK_IN}
          </button>
        )}
        {streak > 0 && (
          <motion.span
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
            className="flex items-center gap-1 rounded-full bg-gold-dim px-2.5 py-1"
          >
            <Flame size={13} strokeWidth={2.6} className="animate-flicker text-gold" fill="currentColor" />
            <span className="text-[12px] font-extrabold text-gold tabular">{streak}</span>
          </motion.span>
        )}
        <span
          className="rounded-full border border-subtle bg-surface px-2.5 py-1 text-[11px] font-bold text-secondary"
          title={getLevelBandName(level)}
        >
          Lv {level}
        </span>
      </div>
    </header>
  );
}
