"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";
import type { Analysis } from "@/lib/analysis/types";
import { rankInsights } from "@/lib/insights/feedData";
import { useAppState } from "@/components/app/AppState";
import { XP_REWARDS } from "@/lib/gamification/xpSystem";
import { recordActivity, activityToday } from "@/lib/gamification/dailyActivity";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";

const READ_IDS_KEY = "ants:insights-read-ids";
const DAILY_XP_CAP = 3; // first three reads per day pay XP
const SHOWN_TODAY = 4; // drip: only this many unlocked per day, rest teased

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
  const insights = useMemo(() => rankInsights(analysis.holdings, SHOWN_TODAY + 1), [analysis]);
  const unlocked = insights.slice(0, SHOWN_TODAY);
  const teaser = insights[SHOWN_TODAY];

  const [openId, setOpenId] = useState<string | null>(null);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [readToday, setReadToday] = useState(0);

  useEffect(() => {
    setRead(readIds());
    setReadToday(activityToday("insight-read"));
  }, []);

  const open = (id: string) => {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next === null || read.has(id)) return;

    // first open of this insight = a read
    const nextRead = new Set(read).add(id);
    setRead(nextRead);
    try {
      localStorage.setItem(READ_IDS_KEY, JSON.stringify([...nextRead]));
    } catch {
      // ignore
    }

    // XP for the first few reads a day — enough to reward, capped to stop farming
    if (readToday < DAILY_XP_CAP) {
      earnXp(XP_REWARDS.MISSION_READ_INSIGHT, "Insight read");
      setReadToday((n) => n + 1);
    }
    recordActivity("insight-read");

    if (nextRead.size >= 10) unlockAchievement("market_watcher");
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
                  {ins.tags.includes("Your portfolio") ? (
                    <Badge tone="gold" size="sm">Your portfolio</Badge>
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
