import { XP_REWARDS } from "./xpSystem";
import { activityToday } from "./dailyActivity";
import type { GamificationState } from "./types";

/**
 * Daily missions — three per day, rotated deterministically by date so every
 * user (and every refresh) sees the same set. Each mission verifies itself
 * from real activity signals; no self-reporting.
 */

export interface MissionDef {
  id: string;
  title: string;
  detail: string;
  xp: number;
  /** is the mission's condition met right now? */
  isDone: (ctx: MissionContext) => boolean;
}

export interface MissionContext {
  gamification: GamificationState;
}

const todayStr = () => new Date().toDateString();

export const MISSION_POOL: MissionDef[] = [
  {
    id: "check-in",
    title: "Check in",
    detail: "Tap the daily check-in — keep the streak fed.",
    xp: XP_REWARDS.DAILY_CHECK_IN,
    isDone: ({ gamification }) =>
      new Date(gamification.lastCheckInDate).toDateString() === todayStr(),
  },
  {
    id: "visit-insights",
    title: "Face your risk",
    detail: "Open the Insights tab and look at the whole picture.",
    xp: XP_REWARDS.MISSION_CHECK_RISK_METRICS,
    isDone: () => {
      try {
        return localStorage.getItem("ants:insights-last-visit") === todayStr();
      } catch {
        return false;
      }
    },
  },
  {
    id: "complete-fix",
    title: "Fix one thing",
    detail: "Mark one portfolio fix done. Small moves compound.",
    xp: XP_REWARDS.MISSION_ACTION,
    isDone: () => activityToday("fix") >= 1,
  },
  {
    id: "research-stock",
    title: "Research before you buy",
    detail: "Run one ticker through the watchlist fit check.",
    xp: XP_REWARDS.MISSION_RESEARCH_STOCK,
    isDone: () => activityToday("research") >= 1,
  },
  {
    id: "ask-ants",
    title: "Ask a real question",
    detail: "Put one doubt to Ask Ants — that's what it's for.",
    xp: XP_REWARDS.MISSION_LEARN,
    isDone: () => activityToday("chat") >= 1,
  },
  {
    id: "tip-check",
    title: "Check a tip before you buy",
    detail: "Run whatever someone pitched you through Tip Check.",
    xp: XP_REWARDS.TIP_CHECKED,
    isDone: () => activityToday("tipcheck") >= 1,
  },
  {
    id: "read-insight",
    title: "Read what's worth knowing",
    detail: "Open one card in the market insights feed.",
    xp: XP_REWARDS.MISSION_READ_INSIGHT,
    isDone: () => activityToday("insight-read") >= 1,
  },
  {
    id: "set-alert",
    title: "Set a price target",
    detail: "Decide your exit before the market decides it for you.",
    xp: XP_REWARDS.MISSION_SET_PRICE_TARGET,
    isDone: () => activityToday("alert-set") >= 1,
  },
];

/** deterministic hash of a date string — same day, same missions, everywhere */
function dateSeed(d: Date): number {
  const s = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** today's three missions, rotated through the pool by date */
export function missionsForToday(now = new Date()): MissionDef[] {
  const seed = dateSeed(now);
  const start = seed % MISSION_POOL.length;
  return [0, 1, 2].map((i) => MISSION_POOL[(start + i * 2) % MISSION_POOL.length])
    // de-dupe in case the stride lands on the same index twice
    .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
    .slice(0, 3);
}

// ─── claim persistence ───────────────────────────────────────────────────────

const CLAIMS_KEY = "ants:daily-missions";

interface ClaimLog {
  date: string;
  claimed: string[]; // mission ids
  aceClaimed: boolean;
}

export function loadClaims(): ClaimLog {
  const today = todayStr();
  try {
    const raw = localStorage.getItem(CLAIMS_KEY);
    const parsed = raw ? (JSON.parse(raw) as ClaimLog) : null;
    if (parsed && parsed.date === today && Array.isArray(parsed.claimed)) return parsed;
  } catch {
    // unreadable — start fresh
  }
  return { date: today, claimed: [], aceClaimed: false };
}

export function saveClaims(log: ClaimLog): void {
  try {
    localStorage.setItem(CLAIMS_KEY, JSON.stringify(log));
  } catch {
    // ignore persistence failures
  }
}
