"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Analysis } from "@/lib/analysis/types";
import type { GamificationState, Achievement } from "@/lib/gamification/types";
import { getLevelForXp, getStreakMultiplier, isNewDayForCheckIn, XP_REWARDS } from "@/lib/gamification/xpSystem";
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/gamification/achievements";

const ANALYZED_KEY = "ants:portfolio-analyzed";
const FIXES_KEY = "ants:done-fixes";
const ANALYSIS_KEY = "ants:analysis";
const IS_DEMO_KEY = "ants:analysis-is-demo";
const GAMIFICATION_KEY = "ants:gamification";

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
    try {
      if (value) localStorage.setItem(ANALYSIS_KEY, JSON.stringify(value));
      else localStorage.removeItem(ANALYSIS_KEY);
      localStorage.setItem(IS_DEMO_KEY, demo ? "true" : "false");
    } catch {
      // ignore persistence failures
    }
  };

  const markFixDone = (id: string) => {
    setDoneFixes((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(FIXES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
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
    setGamification((prev) => {
      const today = new Date().toISOString();
      const lastCheckIn = prev.lastCheckInDate;

      // Check if it's a new day
      if (!isNewDayForCheckIn(lastCheckIn)) {
        return prev; // already checked in today
      }

      let newStreak = prev.dailyStreak.current;
      const lastCheckDate = new Date(prev.dailyStreak.lastCheckInDate);
      const today2 = new Date();

      // Check if yesterday's check-in was within 24h (streak continues)
      const hoursSinceLastCheckIn = (today2.getTime() - lastCheckDate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastCheckIn <= 48) {
        newStreak = prev.dailyStreak.current + 1;
      } else {
        newStreak = 1; // streak broken, restart
      }

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
      localStorage.removeItem(ANALYSIS_KEY);
      localStorage.removeItem(IS_DEMO_KEY);
      localStorage.removeItem("ants:manual-positions");
      // a different portfolio is a different story — the trend restarts
      localStorage.removeItem("ants:score-history");
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
