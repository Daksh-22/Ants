"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppState } from "@/components/app/AppState";
import { isNewDayForCheckIn, XP_REWARDS } from "@/lib/gamification/xpSystem";
import { useCountUp } from "@/lib/hooks/useCountUp";

const SNOOZE_KEY = "ants:checkin-snoozed";
const todayStr = () => new Date().toDateString();

/**
 * Daily check-in — the once-a-day slide-up that keeps the streak alive.
 * Tapping in holds a success beat (flame grows, streak counts up) before the
 * sheet leaves, so the reward actually registers. "Later" costs something
 * when a streak is on the line — it says so.
 */
export function DailyCheckInPrompt() {
  const { gamification, dailyCheckIn } = useAppState();
  const [dismissed, setDismissed] = useState(false);
  const [snoozed, setSnoozed] = useState(true); // default true until session-storage read, avoids a flash
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    try {
      setSnoozed(sessionStorage.getItem(SNOOZE_KEY) === todayStr());
    } catch {
      setSnoozed(false);
    }
  }, []);

  const showPrompt = isNewDayForCheckIn(gamification.lastCheckInDate) && !dismissed && !snoozed;
  const newStreak = gamification.dailyStreak.current + 1;
  const liveStreak = useCountUp(celebrating ? newStreak : gamification.dailyStreak.current, 700);

  const handleLater = () => {
    try {
      sessionStorage.setItem(SNOOZE_KEY, todayStr());
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  const handleCheckIn = () => {
    setCelebrating(true);
    dailyCheckIn();
    setTimeout(() => setDismissed(true), 1100);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end bg-black/60"
          onClick={celebrating ? undefined : handleLater}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="glass relative mx-auto w-full max-w-app rounded-t-3xl px-6 pb-8 pt-3 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* grab handle */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-strong" />

            {/* ambient flame glow */}
            <div className="pointer-events-none absolute left-1/2 top-8 h-28 w-28 -translate-x-1/2 rounded-full bg-gold/20 blur-3xl" />

            <motion.div
              animate={celebrating ? { scale: [1, 1.35, 1.15] } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}
              className="relative text-5xl"
            >
              🔥
            </motion.div>

            {celebrating ? (
              <>
                <p className="mt-4 text-[13px] uppercase tracking-wide text-muted">Streak</p>
                <p className="mt-1 text-display font-extrabold text-gold tabular">
                  {Math.round(liveStreak)}
                </p>
                <p className="mt-1 text-[14px] font-semibold text-primary">days and counting</p>
              </>
            ) : (
              <>
                <h2 className="mt-4 text-heading text-primary">Keep the streak alive</h2>
                <p className="mt-1.5 text-[13px] text-muted">
                  {gamification.dailyStreak.current > 0 ? (
                    <>
                      <span className="font-bold text-gold">{gamification.dailyStreak.current} days</span>{" "}
                      and counting. Show up, collect, move on.
                    </>
                  ) : (
                    <>Day one starts with a tap.</>
                  )}
                </p>

                <div className="mt-5 rounded-2xl bg-elevated px-4 py-3">
                  <p className="text-[13px] text-secondary">
                    Daily check-in pays{" "}
                    <span className="font-bold text-gold">+{XP_REWARDS.DAILY_CHECK_IN} XP</span>
                  </p>
                </div>

                {gamification.dailyStreak.current > 0 && (
                  <p className="mt-3 text-[12px] font-medium text-red">
                    Skip today and your {gamification.dailyStreak.current}-day streak resets to zero.
                  </p>
                )}

                <div className="mt-5 flex gap-3">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleLater}
                    className="flex-1 rounded-2xl bg-elevated py-3.5 text-[14px] font-semibold text-secondary"
                  >
                    Later
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCheckIn}
                    className="flex-1 rounded-2xl fill-gold-gradient py-3.5 text-[14px] font-bold text-ink shadow-cta"
                  >
                    Check in
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
