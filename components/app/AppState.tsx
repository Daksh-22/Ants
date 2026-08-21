"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Analysis } from "@/lib/analysis/types";
import type { GamificationState, Achievement } from "@/lib/gamification/types";
import { getLevelForXp, getStreakMultiplier, isNewDayForCheckIn, nextStreak, XP_REWARDS } from "@/lib/gamification/xpSystem";
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/gamification/achievements";
import { recordActivity, undoActivity } from "@/lib/gamification/dailyActivity";

const ANALYZED_KEY = "ants:portfolio-analyzed";
const FIXES_KEY = "ants:done-fixes";
const ANALYSIS_KEY = "ants:analysis";
const IS_DEMO_KEY = "ants:analysis-is-demo";
const GAMIFICATION_KEY = "ants:gamification";
/** id → XP actually paid for that fix, so undo reverses the real amount */
const FIX_XP_KEY = "ants:fix-xp";

function readFixXpLedger(): Record<string, number> {
  try {
    const raw = localStorage.getItem(FIX_XP_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}

function writeFixXpLedger(next: Record<string, number>): void {
  try {
    localStorage.setItem(FIX_XP_KEY, JSON.stringify(next));
  } catch {
    // ignore persistence failures
  }
}

export interface XpEvent {
  id: number;
  amount: number;
  /** optional context shown under the amount, e.g. an achievement name */
  label?: string;
}

interface AppState {
  /** has the user uploaded/analyzed a portfolio yet? drives /home + bottom nav */
  analyzed: boolean;
  /** false until we've read localStorage on the client — avoids empty→results flash */
  hydrated: boolean;
  /** ids of fixes the user has marked done — drives the health score + card states */
  doneFixes: string[];
  /** the personalized analysis from the backend; null → demo (DEFAULT_ANALYSIS) */
  analysis: Analysis | null;
  /** true when `analysis` is the fallback demo, not the user's real data — the
   *  backend was unreachable when this was set. Results shows a banner + retry. */
  isDemo: boolean;
  /** gamification state: levels, XP, achievements, streaks */
  gamification: GamificationState;
  /** live queue of "+N XP" moments — rendered globally as floating toasts */
  xpEvents: XpEvent[];
  dismissXpEvent: (id: number) => void;
  setAnalyzed: (value: boolean) => void;
  setAnalysis: (analysis: Analysis | null, isDemo?: boolean) => void;
  markFixDone: (id: string) => void;
  /** undo a mis-tapped "mark as done" — the score and card revert with it */
  unmarkFixDone: (id: string) => void;
  /** daily check-in and streak tracking */
  dailyCheckIn: () => void;
  /** earn XP from various actions */
  earnXp: (amount: number, label?: string) => void;
  /** unlock an achievement */
  unlockAchievement: (achievementId: string, bonus?: number) => void;
  /** wipe everything — used by "Scan a different portfolio" */
  reset: () => void;
}

const AppStateContext = createContext<AppState | null>(null);

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// lastCheckInDate starts at epoch so a brand-new user sees the check-in
// prompt on day one — "now" would silently swallow their first streak day
const NEVER = new Date(0).toISOString();

const DEFAULT_GAMIFICATION: GamificationState = {
  level: 1,
  xp: 0,
  totalXpEarned: 0,
  achievements: [],
  dailyStreak: {
    current: 0,
    longest: 0,
    lastCheckInDate: NEVER,
  },
  lastCheckInDate: NEVER,
};

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [analyzed, setAnalyzedState] = useState(false);
  const [doneFixes, setDoneFixes] = useState<string[]>([]);
  const [analysis, setAnalysisState] = useState<Analysis | null>(null);
  const [isDemo, setIsDemoState] = useState(false);
  const [gamification, setGamificationState] = useState<GamificationState>(DEFAULT_GAMIFICATION);
  const [hydrated, setHydrated] = useState(false);
  const [xpEvents, setXpEvents] = useState<XpEvent[]>([]);

  // every XP gain surfaces as a floating "+N XP" toast — the visible reward loop
  const pushXpEvent = (amount: number, label?: string) => {
    if (amount <= 0) return;
    const id = Date.now() + Math.random();
    setXpEvents((prev) => [...prev.slice(-2), { id, amount, label }]);
    // tiny haptic tick where supported (Android Chrome) — feels physical
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(12);
    } catch {
      // not supported — fine
    }
  };

  const dismissXpEvent = (id: number) => {
    setXpEvents((prev) => prev.filter((e) => e.id !== id));
  };

  useEffect(() => {
    try {
      setAnalyzedState(localStorage.getItem(ANALYZED_KEY) === "true");
      const fixes = readJSON<string[]>(FIXES_KEY);
      if (Array.isArray(fixes)) setDoneFixes(fixes.filter((x): x is string => typeof x === "string"));
      const stored = readJSON<Analysis>(ANALYSIS_KEY);
      if (stored && stored.summary && Array.isArray(stored.flags)) setAnalysisState(stored);
      setIsDemoState(localStorage.getItem(IS_DEMO_KEY) === "true");
      const gamState = readJSON<GamificationState>(GAMIFICATION_KEY);
      if (gamState) setGamificationState(gamState);
    } catch {
      // localStorage unavailable — stay in the empty state
    }
    setHydrated(true);
  }, []);

  const setAnalyzed = (value: boolean) => {
    setAnalyzedState(value);
    try {
      if (value) localStorage.setItem(ANALYZED_KEY, "true");
      else localStorage.removeItem(ANALYZED_KEY);
    } catch {
      // ignore persistence failures
    }
  };

  const setAnalysis = (value: Analysis | null, demo = false) => {
    setAnalysisState(value);
    setIsDemoState(demo);

    // Fix ids are static engine constants ("single-concentration",
    // "sector-concentration", …), not per-run. Carrying doneFixes across a
    // re-analysis therefore marked a NEWLY raised flag as already sorted: the
    // card rendered teal with a "Sorted" chip, its points were added to a score
    // the engine never gave, the header claimed "You're on top of it" over an
    // unaddressed red flag, and ScoreTrend wrote the inflated number into
    // permanent history. A fresh analysis is a fresh verdict — if a flag is
    // back, it is not fixed.
    setDoneFixes([]);
    try {
      if (value) localStorage.setItem(ANALYSIS_KEY, JSON.stringify(value));
      else localStorage.removeItem(ANALYSIS_KEY);
      localStorage.setItem(IS_DEMO_KEY, demo ? "true" : "false");
      localStorage.removeItem(FIXES_KEY);
      localStorage.removeItem(FIX_XP_KEY);
    } catch {
      // ignore persistence failures
    }
  };

  /**
   * Marking a fix done owns its whole reward: the ledger entry, the daily
   * activity signal, and the XP. These used to be three separate calls at the
   * call site while undo reversed only the first, so ten mark/undo cycles paid
   * ~250 XP and satisfied the "complete a fix" mission with nothing fixed.
   * Keeping both directions here makes them impossible to desync.
   */
  const markFixDone = (id: string) => {
    if (doneFixes.includes(id)) return;

    const next = [...doneFixes, id];
    setDoneFixes(next);
    try {
      localStorage.setItem(FIXES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }

    // The streak multiplier can differ between marking and undoing, so record
    // what was actually paid rather than recomputing it later and drifting.
    const boosted = Math.round(
      XP_REWARDS.FIX_COMPLETED * getStreakMultiplier(gamification.dailyStreak.current)
    );
    const ledger = readFixXpLedger();
    ledger[id] = boosted;
    writeFixXpLedger(ledger);

    recordActivity("fix");
    adjustXp(boosted, "Fix completed");
  };

  /**
   * Undo a fix. markFixDone only ever appended, so a mis-tap permanently
   * inflated the health score, flipped the card teal for good, wrote a point
   * into the score trend and awarded XP — with the destructive full reset as
   * the only way back. (The watchlist already offers a 4-second undo for the
   * far less consequential act of removing a row.)
   */
  const unmarkFixDone = (id: string) => {
    if (!doneFixes.includes(id)) return;

    const next = doneFixes.filter((f) => f !== id);
    setDoneFixes(next);
    try {
      localStorage.setItem(FIXES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }

    const ledger = readFixXpLedger();
    const paid = ledger[id];
    delete ledger[id];
    writeFixXpLedger(ledger);

    undoActivity("fix");
    // Fixes marked before this ledger existed have no recorded amount. Reverse
    // nothing rather than guessing — an unearned deduction is worse than an
    // un-reversed legacy award.
    if (typeof paid === "number" && paid > 0) adjustXp(-paid, "Fix undone");
  };

  const setGamification = (updater: GamificationState | ((prev: GamificationState) => GamificationState)) => {
    setGamificationState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(GAMIFICATION_KEY, JSON.stringify(next));
      } catch {
        // ignore persistence failures
      }
      return next;
    });
  };

  const dailyCheckIn = () => {
    // Decided BEFORE the updater so the toast can't disagree with the ledger.
    // pushXpEvent used to run unconditionally while the updater returned `prev`
    // unchanged for a repeat check-in, so a second tap inside the sheet's 1100ms
    // dismissal window floated another "+15 XP" that was never awarded.
    if (!isNewDayForCheckIn(gamification.lastCheckInDate)) return;

    setGamification((prev) => {
      if (!isNewDayForCheckIn(prev.lastCheckInDate)) return prev;

      const today = new Date().toISOString();
      const newStreak = nextStreak(prev.dailyStreak.current, prev.dailyStreak.lastCheckInDate);
      const newLongest = Math.max(prev.dailyStreak.longest, newStreak);

      return {
        ...prev,
        lastCheckInDate: today,
        dailyStreak: {
          current: newStreak,
          longest: newLongest,
          lastCheckInDate: today,
        },
        xp: prev.xp + XP_REWARDS.DAILY_CHECK_IN,
        totalXpEarned: prev.totalXpEarned + XP_REWARDS.DAILY_CHECK_IN,
        level: getLevelForXp(prev.totalXpEarned + XP_REWARDS.DAILY_CHECK_IN),
      };
    });
    pushXpEvent(XP_REWARDS.DAILY_CHECK_IN, "Daily check-in");
  };

  /**
   * Apply an already-final XP delta — no streak multiplier, and it may be
   * negative. earnXp boosts what it is given, so it cannot be used to reverse
   * an award without re-boosting it. Totals floor at zero so a reversal can
   * never drive the level below what the remaining XP supports.
   */
  const adjustXp = (delta: number, label?: string) => {
    setGamification((prev) => {
      const newTotalXp = Math.max(0, prev.totalXpEarned + delta);
      return {
        ...prev,
        xp: Math.max(0, prev.xp + delta),
        totalXpEarned: newTotalXp,
        level: getLevelForXp(newTotalXp),
      };
    });
    pushXpEvent(delta, label);
  };

  const earnXp = (amount: number, label?: string) => {
    // streaks pay: every XP gain is boosted up to 1.5x by the current streak
    const boosted = Math.round(amount * getStreakMultiplier(gamification.dailyStreak.current));
    setGamification((prev) => {
      const newTotalXp = prev.totalXpEarned + boosted;
      return {
        ...prev,
        xp: prev.xp + boosted,
        totalXpEarned: newTotalXp,
        level: getLevelForXp(newTotalXp),
      };
    });
    pushXpEvent(boosted, label);
  };

  const unlockAchievement = (achievementId: string, bonus: number = XP_REWARDS.ACHIEVEMENT_BONUS) => {
    // read the pre-update state for the toast decision — the updater below
    // runs lazily at render time, so it can't report back synchronously
    const isNew = !gamification.achievements.some((a) => a.id === achievementId);
    setGamification((prev) => {
      // Check if already unlocked
      if (prev.achievements.some((a) => a.id === achievementId)) {
        return prev;
      }

      const def = ACHIEVEMENT_DEFINITIONS[achievementId];
      const newAchievement: Achievement = {
        id: achievementId,
        name: def?.name ?? achievementId,
        description: def?.description ?? "",
        icon: def?.icon ?? "🏆",
        unlockedAt: new Date().toISOString(),
      };

      const newTotalXp = prev.totalXpEarned + bonus;
      return {
        ...prev,
        achievements: [...prev.achievements, newAchievement],
        xp: prev.xp + bonus,
        totalXpEarned: newTotalXp,
        level: getLevelForXp(newTotalXp),
      };
    });
    if (isNew) {
      const def = ACHIEVEMENT_DEFINITIONS[achievementId];
      pushXpEvent(bonus, `🏆 ${def?.name ?? achievementId}`);
    }
  };

  const reset = () => {
    setAnalyzedState(false);
    setDoneFixes([]);
    setAnalysisState(null);
    setIsDemoState(false);
    // gamification survives on purpose: XP, level and streak belong to the
    // user, not the portfolio — rescanning shouldn't nuke a 30-day streak
    try {
      localStorage.removeItem(ANALYZED_KEY);
      localStorage.removeItem(FIXES_KEY);
      localStorage.removeItem(FIX_XP_KEY);
      localStorage.removeItem(ANALYSIS_KEY);
      localStorage.removeItem(IS_DEMO_KEY);
      // ants:manual-positions is deliberately kept: it seeds the entry form so
      // a rescan starts from what you already hold instead of two blank rows.

      // Everything scoped to the OLD portfolio has to go with it. These were
      // left behind, so after scanning a different book the user still saw the
      // previous portfolio's price alerts — rendered as permanent "not in
      // current portfolio" ghost rows they had to delete one at a time — plus
      // its watchlist, researched tickers and risk history.
      for (const key of [
        "ants:score-history",
        "ants:risk-score-history",
        "ants:watchlist",
        "ants:price-alerts",
        "ants:researched-tickers",
        "ants:insights-read-ids",
      ]) {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  };

  return (
    <AppStateContext.Provider
      value={{
        analyzed,
        hydrated,
        doneFixes,
        analysis,
        isDemo,
        gamification,
        xpEvents,
        dismissXpEvent,
        setAnalyzed,
        setAnalysis,
        markFixDone,
        unmarkFixDone,
        dailyCheckIn,
        earnXp,
        unlockAchievement,
        reset,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within an AppStateProvider");
  return ctx;
}
