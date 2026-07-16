"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Plus, X } from "lucide-react";
import type { Analysis } from "@/lib/analysis/types";
import type { WatchlistItem } from "@/lib/insights/types";
import { checkTip, type TipCheckResult } from "@/lib/api/portfolio";
import { useAppState } from "@/components/app/AppState";
import { XP_REWARDS } from "@/lib/gamification/xpSystem";
import { recordActivity } from "@/lib/gamification/dailyActivity";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { Card } from "@/components/ui/Card";
import { formatINR } from "@/lib/utils/formatINR";
import { cn } from "@/lib/utils/cn";

const WATCHLIST_KEY = "ants:watchlist";
const RESEARCHED_KEY = "ants:researched-tickers";
const UNDO_WINDOW_MS = 4000;

interface SmartWatchlistProps {
  analysis: Analysis;
}

/** derive a 0–100 fit score from the tip-check engine's verdict */
function fitScoreFrom(result: TipCheckResult): number {
  let score = result.tone === "ok" ? 80 : result.tone === "caution" ? 55 : 30;
  if (!result.known) return 15; // can't price it — that's the whole answer
  // genuine diversification pays; doubling down costs
  if (result.alreadyOwnWeightPct == null && (result.sectorWeightAfter ?? 0) <= 30) score += 10;
  if ((result.alreadyOwnWeightPct ?? 0) >= 15) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function fitTone(score: number): string {
  if (score >= 70) return "text-teal";
  if (score >= 45) return "text-amber";
  return "text-red";
}

function fitToneBg(score: number): string {
  if (score >= 70) return "bg-teal-dim";
  if (score >= 45) return "bg-amber-dim";
  return "bg-red-dim";
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function FitChip({
  score,
  ticker,
  reveal,
  onToggle,
}: {
  score: number;
  ticker: string;
  reveal: boolean;
  onToggle: () => void;
}) {
  const live = useCountUp(score, 800);
  const t = Math.round(live);
  return (
    <motion.button
      onClick={onToggle}
      animate={reveal ? { scale: [0.6, 1.1, 1] } : {}}
      transition={{ duration: 0.7 }}
      className={cn("flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl", fitToneBg(t))}
      aria-label={`${ticker} fit score`}
    >
      <span className={cn("text-[15px] font-extrabold tabular", fitTone(t))}>{t}</span>
      <span className={cn("text-[8px] font-semibold uppercase", fitTone(t))}>fit</span>
    </motion.button>
  );
}

/**
 * Smart watchlist — research a ticker BEFORE the money moves. Each stock gets
 * a fit score computed against YOUR actual portfolio by the same engine that
 * powers Tip Check. First research of each new ticker pays XP; five unique
 * tickers unlocks the Researcher badge.
 */
export function SmartWatchlist({ analysis }: SmartWatchlistProps) {
  const { earnXp, unlockAchievement } = useAppState();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [ticker, setTicker] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<{ item: WatchlistItem; timer: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    const stored = readJSON<WatchlistItem[]>(WATCHLIST_KEY);
    if (Array.isArray(stored)) setItems(stored);
  }, []);

  const persist = (next: WatchlistItem[]) => {
    setItems(next);
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
    } catch {
      // ignore persistence failures
    }
  };

  const addTicker = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t || checking) return;
    if (items.some((i) => i.ticker === t)) {
      setError("Already on your watchlist.");
      return;
    }

    setChecking(true);
    setError(null);
    try {
      const positions = analysis.holdings.map((h) => ({ ticker: h.ticker, qty: h.qty, avg: h.avg }));
      const result = await checkTip(t, positions);
      const item: WatchlistItem = {
        ticker: result.ticker,
        name: result.name,
        sector: result.sector,
        cmp: result.cmp,
        fit_score: fitScoreFrom(result),
        tone: result.tone,
        verdict: result.verdict,
        added_at: new Date().toISOString(),
      };
      persist([item, ...items]);
      setTicker("");
      setExpanded(item.ticker);
      setJustAdded(item.ticker);
      setTimeout(() => setJustAdded((cur) => (cur === item.ticker ? null : cur)), 900);
      recordActivity("research");

      // first research of a NEW ticker pays XP; 5 unique unlocks Researcher
      const researched = new Set(readJSON<string[]>(RESEARCHED_KEY) ?? []);
      if (!researched.has(item.ticker)) {
        researched.add(item.ticker);
        try {
          localStorage.setItem(RESEARCHED_KEY, JSON.stringify([...researched]));
        } catch {
          // ignore
        }
        earnXp(XP_REWARDS.MISSION_RESEARCH_STOCK, "Stock researched");
        if (researched.size >= 5) unlockAchievement("researcher");
      }
    } catch {
      setError("Can't reach the fit engine right now — try again in a bit.");
    } finally {
      setChecking(false);
    }
  };

  const remove = (item: WatchlistItem) => {
    persist(items.filter((i) => i.ticker !== item.ticker));
    // undo snackbar — a removed research target is one tap from coming back
    if (pendingUndo) clearTimeout(pendingUndo.timer);
    const timer = setTimeout(() => setPendingUndo(null), UNDO_WINDOW_MS);
    setPendingUndo({ item, timer });
  };

  const undoRemove = () => {
    if (!pendingUndo) return;
    clearTimeout(pendingUndo.timer);
    persist([pendingUndo.item, ...items]);
    setPendingUndo(null);
  };

  return (
    <Card className="relative">
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-[15px] font-semibold text-primary">Watchlist</p>
        <p className="text-[11px] text-muted">+{XP_REWARDS.MISSION_RESEARCH_STOCK} XP per research</p>
      </div>
      <p className="text-[12px] text-muted">
        The gut check before the buy — fit is scored against <em>your</em> portfolio, not the market&apos;s mood.
      </p>

      {/* add row */}
      <div className="mt-4 flex gap-2">
        <input
          value={ticker}
          onChange={(e) => {
            setTicker(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && addTicker()}
          placeholder="Ticker — TCS, ZOMATO, HAL…"
          className="min-w-0 flex-1 rounded-xl bg-elevated px-3.5 py-2.5 text-[14px] text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-gold"
        />
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={addTicker}
          disabled={checking || !ticker.trim()}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-xl px-4 py-2.5 text-[13px] font-bold",
            checking || !ticker.trim() ? "bg-elevated text-muted" : "fill-gold-gradient text-ink shadow-cta"
          )}
        >
          {checking ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} strokeWidth={3} />}
          Check
        </motion.button>
      </div>
      {error && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[12px] text-red">{error}</p>
          <button onClick={addTicker} className="shrink-0 text-[12px] font-bold text-gold">
            Retry
          </button>
        </div>
      )}

      {/* the list */}
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.div
            key={item.ticker}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl bg-elevated p-3.5">
              <div className="flex items-center gap-3">
                <FitChip
                  score={item.fit_score}
                  ticker={item.ticker}
                  reveal={justAdded === item.ticker}
                  onToggle={() => setExpanded(expanded === item.ticker ? null : item.ticker)}
                />

                <button
                  onClick={() => setExpanded(expanded === item.ticker ? null : item.ticker)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-[14px] font-semibold text-primary">{item.name}</p>
                  <p className="text-[11px] text-muted">
                    {item.sector ?? "Unknown"}
                    {item.cmp != null && <> · {formatINR(item.cmp)}</>}
                  </p>
                </button>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => remove(item)}
                  className="shrink-0 p-1 text-muted"
                  aria-label={`Remove ${item.name}`}
                >
                  <X size={15} />
                </motion.button>
              </div>

              <AnimatePresence>
                {expanded === item.ticker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="mt-3 border-t border-subtle pt-3 text-[13px] leading-[1.55] text-secondary">
                      {item.verdict}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {items.length === 0 && (
        <p className="mt-4 text-center text-[12px] text-muted">
          Nothing here yet. Type the ticker your group chat won&apos;t shut up about.
        </p>
      )}

      {/* undo snackbar */}
      <AnimatePresence>
        {pendingUndo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-3 flex items-center justify-between rounded-xl bg-pressed px-3.5 py-2.5"
          >
            <span className="text-[12px] text-secondary">{pendingUndo.item.ticker} removed</span>
            <button onClick={undoRemove} className="text-[12px] font-bold text-gold">
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
