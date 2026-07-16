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
  const current = Math.round(intoBand % perLevel);
  const needed = Math.round(perLevel);
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
  return lastDate.toDateString() !== today.toDateString();
}
