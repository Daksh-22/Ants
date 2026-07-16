/**
 * Daily activity signals — tiny localStorage counters that let daily missions
 * verify themselves from what the user ACTUALLY did today, instead of trusting
 * a self-reported "mark done" tap.
 *
 * Shape: ants:daily-activity = { date: "Mon Jul 13 2026", counts: { fix: 2, research: 1 } }
 * Rolls over automatically: any read/write on a new day resets the counts.
 */

const KEY = "ants:daily-activity";

export type ActivityKind = "fix" | "research" | "chat" | "insight-read" | "tipcheck" | "alert-set";

interface DayLog {
  date: string;
  counts: Partial<Record<ActivityKind, number>>;
}

function load(): DayLog {
  const today = new Date().toDateString();
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as DayLog) : null;
    if (parsed && parsed.date === today && parsed.counts) return parsed;
  } catch {
    // unreadable — start fresh
  }
  return { date: today, counts: {} };
}

/** bump today's counter for a kind of activity */
export function recordActivity(kind: ActivityKind): void {
  const log = load();
  log.counts[kind] = (log.counts[kind] ?? 0) + 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    // ignore persistence failures
  }
}

/** how many times this activity happened today */
export function activityToday(kind: ActivityKind): number {
  return load().counts[kind] ?? 0;
}
