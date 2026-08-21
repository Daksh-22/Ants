/**
 * Lifetime counters that outlive a single day.
 *
 * dailyActivity resets at local midnight, which is right for missions but wrong
 * for milestone badges. Two achievements were defined against counters that
 * existed nowhere — ask_ants_master ("ask 10 questions") and benchmark_beater
 * ("beat the index on 30 days") — so both were permanently unreachable and
 * their progress bars showed nothing. These are the missing sources.
 */

const CHAT_COUNT_KEY = "ants:chat-count";
const BENCH_DAYS_KEY = "ants:benchmark-beat-days";

function readNumber(key: string): number {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** total Ask Ants questions answered, ever */
export function chatCount(): number {
  return readNumber(CHAT_COUNT_KEY);
}

export function bumpChatCount(): number {
  const next = chatCount() + 1;
  try {
    localStorage.setItem(CHAT_COUNT_KEY, String(next));
  } catch {
    // ignore persistence failures
  }
  return next;
}

function readDays(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(BENCH_DAYS_KEY) ?? "null");
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === "string") : [];
  } catch {
    return [];
  }
}

/** distinct local days on which the portfolio was ahead of the index */
export function benchmarkBeatDays(): number {
  return readDays().length;
}

/**
 * Record that today the portfolio was (or wasn't) ahead of the index.
 *
 * Deliberately a SET of day keys, not a counter: /insights can render many times
 * a day, and an increment-per-render would have turned "beat the index on 30
 * days" into "open the insights tab 30 times".
 */
export function recordBenchmarkDay(beatingIndex: boolean): number {
  if (!beatingIndex) return benchmarkBeatDays();
  const today = new Date().toDateString();
  const days = readDays();
  if (days.includes(today)) return days.length;
  const next = [...days, today].slice(-400);
  try {
    localStorage.setItem(BENCH_DAYS_KEY, JSON.stringify(next));
  } catch {
    // ignore persistence failures
  }
  return next.length;
}
