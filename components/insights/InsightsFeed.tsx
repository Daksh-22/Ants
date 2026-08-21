"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";
import type { Analysis } from "@/lib/analysis/types";
import { rankInsights } from "@/lib/insights/feedData";
import { useAppState } from "@/components/app/AppState";
import { XP_REWARDS } from "@/lib/gamification/xpSystem";
import { recordActivity } from "@/lib/gamification/dailyActivity";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";

const READ_IDS_KEY = "ants:insights-read-ids";
const PAID_TODAY_KEY = "ants:insights-paid-today";
const DAILY_XP_CAP = 3; // first three reads per day pay XP
const SHOWN_TODAY = 4; // drip: only this many unlocked per day, rest teased

/** the local-day key dailyActivity and dailyMissions both use */
const localDayKey = () => new Date().toDateString();

interface PaidLog {
  date: string;
  ids: string[];
}

/**
 * Which insights already paid XP TODAY.
 *
 * The XP gate used to be the LIFETIME read set, and `open()` returned early for
 * anything already read. INSIGHT_POOL has 13 entries and 4 rotate in per day, so
 * every card was read by about day 4 — after which the header advertised "3 XP
 * reads left today" every single day while every card showed "✓ read" and no XP
 * was obtainable, recoverable only by wiping all app state. Reading is worth XP
 * again each day; a given card just can't pay twice in the same day.
 */
function readPaidToday(): Set<string> {
  const today = localDayKey();
  try {
    const raw = localStorage.getItem(PAID_TODAY_KEY);
    const parsed = raw ? (JSON.parse(raw) as PaidLog) : null;
    if (parsed && parsed.date === today && Array.isArray(parsed.ids)) return new Set(parsed.ids);
  } catch {
    // unreadable — treat today as fresh
  }
  return new Set();
}

function writePaidToday(ids: Set<string>): void {
  try {
    localStorage.setItem(PAID_TODAY_KEY, JSON.stringify({ date: localDayKey(), ids: [...ids] }));
  } catch {
    // ignore persistence failures
  }
}

/**
 * Day index, so the daily slice actually rotates.
 *
 * rankInsights is a pure function of holdings with no date input, and the
 * teased 5th card was locked behind a label reading "Tomorrow" — forever. A
 * user who came back the next day to collect it found the same four cards and
 * the same permanent lock. Same one-line seed the daily missions use.
 */
function dayIndex(): number {
  // Local days, not UTC. Date.now()/86_400_000 counts UTC days while the read
  // counter (dailyActivity) rolls over at LOCAL midnight, so in IST the two
  // disagreed for the first 5.5 hours of every day: at 00:05 the header reset to
  // "3 XP reads left today" but the card window did not advance until 05:30, so
  // all four cards still showed "✓ read" and paid nothing for hours.
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000);
}

interface InsightsFeedProps {
  analysis: Analysis;
}

function readIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_IDS_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/**
 * Market insights feed — sector reads ranked by what the user actually holds
 * (your 40% IT slice makes the IT insight rank first). Opening one counts as
 * a read: first three each day pay XP, ten lifetime unlocks Market Watcher.
 * Only today's top few unlock; the rest tease with a blurred title — content
 * drips instead of dumping the whole feed at once.
 */
export function InsightsFeed({ analysis }: InsightsFeedProps) {
  const { earnXp, unlockAchievement } = useAppState();
  // Rank the whole pool, then rotate the window by day so tomorrow genuinely
  // brings different cards and the teased one actually arrives.
  const ranked = useMemo(() => rankInsights(analysis.holdings, 99), [analysis]);
  const insights = useMemo(() => {
    if (ranked.length === 0) return [];
    const offset = (dayIndex() * SHOWN_TODAY) % ranked.length;
    const rotated = [...ranked.slice(offset), ...ranked.slice(0, offset)];
    return rotated.slice(0, SHOWN_TODAY + 1);
  }, [ranked]);
  const unlocked = insights.slice(0, SHOWN_TODAY);
  const teaser = insights[SHOWN_TODAY];

  const [openId, setOpenId] = useState<string | null>(null);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [paidToday, setPaidToday] = useState<Set<string>>(new Set());

  useEffect(() => {
    setRead(readIds());
    setPaidToday(readPaidToday());
  }, []);

  // What the three dots show: reads that actually paid today, capped.
  const readToday = Math.min(paidToday.size, DAILY_XP_CAP);

  const open = (id: string) => {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next === null) return;

    // Lifetime read set — drives the "✓ read" badge and Market Watcher only.
    if (!read.has(id)) {
      const nextRead = new Set(read).add(id);
      setRead(nextRead);
      try {
        localStorage.setItem(READ_IDS_KEY, JSON.stringify([...nextRead]));
      } catch {
        // ignore
      }
      if (nextRead.size >= 10) unlockAchievement("market_watcher");
    }

    // Reward is scoped to TODAY: a card pays once per day, up to the daily cap.
    if (paidToday.has(id) || paidToday.size >= DAILY_XP_CAP) return;
    const nextPaid = new Set(paidToday).add(id);
    setPaidToday(nextPaid);
    writePaidToday(nextPaid);
    earnXp(XP_REWARDS.MISSION_READ_INSIGHT, "Insight read");
    recordActivity("insight-read");
  };

  return (
    <Card>
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-[15px] font-semibold text-primary">Worth knowing</p>
        <p className="text-[11px] text-muted">ranked for your holdings</p>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {Array.from({ length: DAILY_XP_CAP }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              i < readToday ? "bg-gold" : "bg-pressed"
            )}
          />
        ))}
        <span className="text-[11px] text-muted">
          {Math.max(0, DAILY_XP_CAP - readToday)} XP read{DAILY_XP_CAP - readToday === 1 ? "" : "s"} left today
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {unlocked.map((ins) => {
          const isOpen = openId === ins.id;
          const isRead = read.has(ins.id);
          return (
            <div key={ins.id} className="overflow-hidden rounded-xl bg-elevated">
              <button onClick={() => open(ins.id)} className="w-full px-3.5 py-3 text-left">
                <div className="flex items-center gap-2">
                  {/* Three states, not two. The badge was a binary on the
                      "Your portfolio" tag, so a sector read for a sector the
                      user simply doesn't hold was labelled "Macro" — e.g. a
                      Pharma piece badged Macro for an IT-and-Banking book. */}
                  {ins.tags.includes("Your portfolio") ? (
                    <Badge tone="gold" size="sm">Your portfolio</Badge>
                  ) : ins.sector ? (
                    <Badge tone="purple" size="sm">Sector</Badge>
                  ) : (
                    <Badge tone="purple" size="sm">Macro</Badge>
                  )}
                  {isRead && <span className="text-[10px] font-semibold text-teal">✓ read</span>}
                </div>
                <p
                  className={cn(
                    "mt-1.5 text-[14px] font-semibold leading-snug",
                    isRead && !isOpen ? "text-secondary" : "text-primary"
                  )}
                >
                  {ins.title}
                </p>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 320, damping: 34 }}
                    className="overflow-hidden"
                  >
                    <p className="border-t border-subtle px-3.5 py-3 text-[13px] leading-[1.6] text-secondary">
                      {ins.body}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {teaser && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-elevated px-3.5 py-3">
            <p className="min-w-0 select-none truncate text-[13px] font-medium text-secondary blur-[3px]">
              {teaser.title}
            </p>
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-gold">
              <Lock size={12} />
              Tomorrow
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
