"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Target, X } from "lucide-react";
import type { Analysis } from "@/lib/analysis/types";
import type { PriceAlert } from "@/lib/insights/types";
import { useAppState } from "@/components/app/AppState";
import { XP_REWARDS } from "@/lib/gamification/xpSystem";
import { recordActivity } from "@/lib/gamification/dailyActivity";
import { Card } from "@/components/ui/Card";
import { formatINR } from "@/lib/utils/formatINR";
import { cn } from "@/lib/utils/cn";

const ALERTS_KEY = "ants:price-alerts";

interface PriceAlertsProps {
  analysis: Analysis;
}

function loadAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
    const arr = raw ? (JSON.parse(raw) as PriceAlert[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * Price alerts — set a target on a holding; when the reference price crosses
 * it, the alert fires and pays XP. Direction is inferred: target above the
 * current price = sell target, below = buy-the-dip target. Progress is
 * measured from the price AT CREATION toward the target, so the bar starts
 * near 0% and actually means something (older alerts without a saved
 * creation price fall back to the old, rougher estimate).
 */
export function PriceAlerts({ analysis }: PriceAlertsProps) {
  const { earnXp, unlockAchievement } = useAppState();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [ticker, setTicker] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justTriggered, setJustTriggered] = useState<string | null>(null);

  const cmpOf = (t: string) => analysis.holdings.find((h) => h.ticker === t)?.cmp ?? null;

  const persist = (next: PriceAlert[]) => {
    setAlerts(next);
    try {
      localStorage.setItem(ALERTS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  // load + trigger sweep: fire any active alert whose price has crossed
  useEffect(() => {
    const stored = loadAlerts();
    let fired = 0;
    let firstFiredKey: string | null = null;
    const swept = stored.map((a) => {
      if (a.status !== "active") return a;
      const cmp = cmpOf(a.ticker);
      if (cmp == null) return a;
      const hitSell = a.sell_target != null && cmp >= a.sell_target;
      const hitBuy = a.buy_target != null && cmp <= a.buy_target;
      if (hitSell || hitBuy) {
        fired += 1;
        if (!firstFiredKey) firstFiredKey = `${a.ticker}-${a.created_at}`;
        return { ...a, status: "triggered" as const, triggered_at: new Date().toISOString() };
      }
      return a;
    });

    if (fired > 0) {
      earnXp(fired * XP_REWARDS.PRICE_TARGET_HIT, "Price target hit");
      const totalTriggered = swept.filter((a) => a.status === "triggered").length;
      if (totalTriggered >= 1) unlockAchievement("target_spotter");
      if (totalTriggered >= 5) unlockAchievement("hawkeye");
      persist(swept);
      if (firstFiredKey) {
        setJustTriggered(firstFiredKey);
        setTimeout(() => setJustTriggered(null), 2200);
      }
    } else {
      setAlerts(swept);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  const addAlert = () => {
    const t = ticker.trim().toUpperCase();
    const price = parseFloat(target);
    setError(null);

    const cmp = cmpOf(t);
    if (!t || cmp == null) {
      setError("Pick one of your holdings.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a real target price.");
      return;
    }
    if (Math.abs(price - cmp) / cmp < 0.005) {
      setError("That's basically the current price — aim somewhere.");
      return;
    }
    if (alerts.some((a) => a.ticker === t && a.status === "active")) {
      setError("One active alert per stock — remove the old one first.");
      return;
    }

    const alert: PriceAlert = {
      ticker: t,
      sell_target: price > cmp ? price : undefined,
      buy_target: price < cmp ? price : undefined,
      created_price: cmp,
      created_at: new Date().toISOString(),
      status: "active",
    };
    persist([alert, ...alerts]);
    setTicker("");
    setTarget("");
    recordActivity("alert-set");
    earnXp(XP_REWARDS.MISSION_SET_PRICE_TARGET, "Price target set");
  };

  const remove = (a: PriceAlert) =>
    persist(alerts.filter((x) => !(x.ticker === a.ticker && x.created_at === a.created_at)));

  return (
    <Card>
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-[15px] font-semibold text-primary">Price alerts</p>
        <p className="text-[11px] text-muted">+{XP_REWARDS.PRICE_TARGET_HIT} XP when one hits</p>
      </div>
      <p className="text-[12px] text-muted">
        Above the current price = sell target. Below = buy-the-dip. Decide now, not in the moment.
      </p>

      {/* add row */}
      <div className="mt-4 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <select
            value={ticker}
            onChange={(e) => {
              setTicker(e.target.value);
              setError(null);
            }}
            className="w-full appearance-none rounded-xl bg-elevated px-3.5 py-2.5 pr-8 text-[14px] text-primary focus:outline-none focus:ring-1 focus:ring-gold"
          >
            <option value="">Pick a holding…</option>
            {analysis.holdings.map((h) => (
              <option key={h.ticker} value={h.ticker}>
                {h.ticker} · {formatINR(h.cmp)}
              </option>
            ))}
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
        </div>
        <input
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && addAlert()}
          inputMode="decimal"
          placeholder="Target ₹"
          className="w-24 shrink-0 rounded-xl bg-elevated px-3 py-2.5 text-[14px] text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-gold"
        />
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={addAlert}
          className="flex shrink-0 items-center rounded-xl fill-gold-gradient px-3.5 text-[13px] font-bold text-ink shadow-cta"
          aria-label="Set alert"
        >
          <Target size={15} strokeWidth={2.6} />
        </motion.button>
      </div>
      {error && <p className="mt-2 text-[12px] text-red">{error}</p>}

      {/* alerts list */}
      <AnimatePresence initial={false}>
        {alerts.map((a) => {
          const key = `${a.ticker}-${a.created_at}`;
          const cmp = cmpOf(a.ticker);
          const goal = a.sell_target ?? a.buy_target ?? 0;
          const isSell = a.sell_target != null;
          const base = a.created_price ?? cmp ?? goal;
          // progress from the price AT CREATION toward the target — a 0%
          // start that actually means something, not a coincidence of scale
          const progress =
            cmp == null || base === goal
              ? 0
              : Math.max(0, Math.min(100, ((cmp - base) / (goal - base)) * 100));
          const triggered = a.status === "triggered";
          const celebrating = justTriggered === key;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="overflow-hidden"
            >
              <div
                className={cn(
                  "relative mt-3 overflow-hidden rounded-xl bg-elevated p-3.5",
                  triggered && "ring-1 ring-gold"
                )}
              >
                {celebrating && <CelebrationSheen />}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-primary">
                      {a.ticker}
                      <span className={cn("ml-2 text-[11px] font-bold", isSell ? "text-teal" : "text-amber")}>
                        {isSell ? "SELL @" : "BUY @"} {formatINR(goal)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {triggered
                        ? celebrating
                          ? `🎯 ${a.ticker} hit your target! +${XP_REWARDS.PRICE_TARGET_HIT} XP`
                          : `🎯 Hit! +${XP_REWARDS.PRICE_TARGET_HIT} XP`
                        : cmp != null
                          ? `now ${formatINR(cmp)} · ${progress.toFixed(1)}% there`
                          : "not in current portfolio"}
                    </p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => remove(a)}
                    className="shrink-0 p-1 text-muted"
                    aria-label={`Remove ${a.ticker} alert`}
                  >
                    <X size={15} />
                  </motion.button>
                </div>

                {!triggered && (
                  <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-pressed">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 22 }}
                      className={cn("h-full rounded-full", isSell ? "bg-teal" : "bg-amber")}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {alerts.length === 0 && (
        <p className="mt-4 text-center text-[12px] text-muted">
          No targets set. Exits planned in daylight beat exits panicked at 3am.
        </p>
      )}
    </Card>
  );
}

function CelebrationSheen() {
  const sparks = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    return { x: Math.cos(angle) * 50, y: Math.sin(angle) * 30 };
  });
  return (
    <div className="pointer-events-none absolute inset-0">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.6 }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-gold/20 to-transparent"
      />
      <div className="absolute right-8 top-1/2">
        {sparks.map((s, i) => (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: s.x, y: s.y, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute h-1.5 w-1.5 rounded-full bg-gold"
          />
        ))}
      </div>
    </div>
  );
}
