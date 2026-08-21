import { LevelBand } from './types';

/**
 * Level bands, Rookie → Whale. Levels interpolate smoothly inside each band
 * (e.g. Rookie is 100 XP per level), so early levels come fast — the
 * Subway-Surfers rule: you're always being rewarded in small ways.
 */
interface Band {
  startLevel: number;
  endLevel: number;
  minXp: number;
  maxXp: number;
  name: string;
  description: string;
}

const BANDS: Band[] = [
  { startLevel: 1, endLevel: 10, minXp: 0, maxXp: 1000, name: 'Rookie', description: 'Learning the basics' },
  { startLevel: 11, endLevel: 25, minXp: 1000, maxXp: 3500, name: 'Apprentice', description: 'Building discipline' },
  { startLevel: 26, endLevel: 40, minXp: 3500, maxXp: 7500, name: 'Analyst', description: 'Serious investor' },
  { startLevel: 41, endLevel: 60, minXp: 7500, maxXp: 15000, name: 'Pro', description: 'Trusted strategy' },
  { startLevel: 61, endLevel: 80, minXp: 15000, maxXp: 25000, name: 'Master', description: 'Wealth builder' },
  { startLevel: 81, endLevel: 100, minXp: 25000, maxXp: 45000, name: 'Whale', description: 'Market sage' },
];

/** kept for consumers that want the display table */
export const LEVEL_BANDS: LevelBand[] = BANDS.map((b) => ({
  level: b.startLevel,
  minXp: b.minXp,
  maxXp: b.maxXp,
  name: b.name,
  description: b.description,
}));

// XP rewards for different actions
export const XP_REWARDS = {
  DAILY_CHECK_IN: 15,
  FIX_COMPLETED: 25,
  MISSION_PORTFOLIO_CHECK: 50,
  MISSION_LEARN: 30,
  MISSION_ACTION: 40,
  MISSION_INSIGHT: 25,
  MISSION_SOCIAL: 35,
  DAILY_ACE_BONUS: 20, // complete all 3 daily missions
  ACHIEVEMENT_BONUS: 100,
  // Phase 2: Insights & Analytics
  MISSION_CHECK_RISK_METRICS: 15,
  MISSION_BENCHMARK_CHECK: 20,
  MISSION_RESEARCH_STOCK: 20,
  MISSION_READ_INSIGHT: 10, // per insight
  MISSION_SET_PRICE_TARGET: 15,
  MISSION_READ_3_INSIGHTS: 25,
  MISSION_BEAT_NIFTY: 30,
  PRICE_TARGET_HIT: 100,
  TIP_CHECKED: 20,
} as const;

function bandForXp(totalXp: number): Band {
  return BANDS.find((b) => totalXp < b.maxXp) ?? BANDS[BANDS.length - 1];
}

/** XP needed to climb one level inside this band */
function xpPerLevel(band: Band): number {
  return (band.maxXp - band.minXp) / (band.endLevel - band.startLevel + 1);
}

/** Continuous level 1–100: interpolates within the band so levels come steadily. */
export function getLevelForXp(totalXp: number): number {
  const band = bandForXp(Math.max(0, totalXp));
  const levelsIn = Math.floor((totalXp - band.minXp) / xpPerLevel(band));
  return Math.min(100, band.startLevel + Math.max(0, levelsIn));
}

/** Progress toward the NEXT level (not the next band) — what the gold bar shows. */
export function getXpProgressInLevel(totalXp: number): {
  current: number;
  needed: number;
  percent: number;
} {
  const band = bandForXp(Math.max(0, totalXp));
  const perLevel = xpPerLevel(band);
  const intoBand = Math.max(0, totalXp - band.minXp);
  const needed = Math.round(perLevel);

  // getLevelForXp clamps at 100 but this kept cycling intoBand % perLevel past
  // the top band's ceiling, so every 1,000 XP after 45,000 replayed a full bar
  // fill that resolved to nothing: "Level 100 · Whale · 600/1000", then a snap
  // back to 0/1000, forever. At the cap the bar is simply full and stays full.
  if (getLevelForXp(totalXp) >= 100) {
    return { current: needed, needed, percent: 100 };
  }

  const current = Math.round(intoBand % perLevel);
  return { current, needed, percent: Math.min(100, (current / needed) * 100) };
}

export function getStreakMultiplier(streakDays: number): number {
  // 1.0x base, +0.1x per day, capped at 1.5x
  return Math.min(1.5, 1.0 + streakDays * 0.1);
}

export function getLevelBandName(level: number): string {
  const band = BANDS.find((b) => level <= b.endLevel) ?? BANDS[BANDS.length - 1];
  return band.name;
}

export function isNewDayForCheckIn(lastCheckInDate: string): boolean {
  const lastDate = new Date(lastCheckInDate);
  const today = new Date();
  if (Number.isNaN(lastDate.getTime())) return true;
  return lastDate.toDateString() !== today.toDateString();
}

/** local midnight for a date — the boundary the check-in gate already uses */
function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Whole calendar days between two instants, counted by local midnights so the
 * result never depends on the time of day.
 */
export function calendarDaysBetween(from: Date, to: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((startOfLocalDay(to) - startOfLocalDay(from)) / MS_PER_DAY);
}

/**
 * What a check-in today does to the streak.
 *
 * The gate above is a CALENDAR-day test while the continuation test used to be
 * a rolling 48-HOUR window, and the two disagree by a full day. Checking in
 * Monday 23:00 and again Wednesday 22:00 is 47h, so a completely skipped
 * Tuesday extended the streak — while Monday 01:00 to Wednesday 23:00 is 70h
 * and reset it, despite being the same one-missed-day pattern. Time of day
 * decided whether a skipped day counted.
 *
 * Now it is calendar days throughout, matching what the UI promises ("miss two
 * days running and your streak resets"):
 *   1 day  → consecutive, extend
 *   2 days → exactly one day missed, the documented single-day grace, extend
 *   3+     → two or more missed, reset to 1
 */
export function nextStreak(current: number, lastCheckInDate: string, now = new Date()): number {
  const last = new Date(lastCheckInDate);
  if (Number.isNaN(last.getTime())) return 1;

  const gap = calendarDaysBetween(last, now);
  if (gap <= 0) return Math.max(1, current); // same day — the gate should have caught this
  if (gap <= 2) return current + 1;
  return 1;
}
