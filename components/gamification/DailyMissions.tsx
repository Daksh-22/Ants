"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useAppState } from "@/components/app/AppState";
import {
  missionsForToday,
  loadClaims,
  saveClaims,
  type MissionDef,
} from "@/lib/gamification/dailyMissions";
import { XP_REWARDS } from "@/lib/gamification/xpSystem";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

/**
 * Daily missions — three a day, rotated by date, each verified from real
 * activity (no self-reporting). Do the thing → the Claim button breathes →
 * tap it → XP lands with a spring check. All three claimed fires a
 * card-level gold celebration for the Daily Ace bonus.
 */
export function DailyMissions() {
  const { earnXp, gamification } = useAppState();
  // missionsForToday is pure/synchronous — no first-paint layout shift
  const [missions] = useState<MissionDef[]>(() => missionsForToday());
  const [claimed, setClaimed] = useState<string[]>(() => loadClaims().claimed);
  const [aceClaimed, setAceClaimed] = useState(() => loadClaims().aceClaimed);
  const [aceCelebrating, setAceCelebrating] = useState(false);
  // bump to re-evaluate isDone() after activity elsewhere on the page/app
  const [, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", bump);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", bump);
    };
  }, []);

  if (missions.length === 0) return null;

  const claim = (m: MissionDef) => {
    if (claimed.includes(m.id)) return;
    const nextClaimed = [...claimed, m.id];
    setClaimed(nextClaimed);
    earnXp(m.xp, m.title);

    // all three down → Daily Ace bonus, once, with a card-level celebration
    let nextAce = aceClaimed;
    if (!aceClaimed && missions.every((x) => nextClaimed.includes(x.id))) {
      nextAce = true;
      setAceClaimed(true);
      setAceCelebrating(true);
      earnXp(XP_REWARDS.DAILY_ACE_BONUS, "Daily Ace — all 3 done");
      setTimeout(() => setAceCelebrating(false), 1500);
    }
    saveClaims({ date: new Date().toDateString(), claimed: nextClaimed, aceClaimed: nextAce });
  };

  const allDone = missions.every((m) => claimed.includes(m.id));

  return (
    <Card className={cn("relative overflow-hidden", aceCelebrating && "shadow-glow-gold-lg")}>
      {aceCelebrating && <AceSparkBurst />}
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-semibold text-primary">Today&apos;s missions</p>
        <div className="flex items-center gap-1.5">
          {missions.map((m) => (
            <span
              key={m.id}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                claimed.includes(m.id) ? "bg-teal" : "bg-pressed"
              )}
            />
          ))}
          {allDone && aceClaimed && (
            <span className="ml-1 text-[11px] font-bold text-gold">ACE +{XP_REWARDS.DAILY_ACE_BONUS}</span>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        {missions.map((m) => {
          const isClaimed = claimed.includes(m.id);
          const isDone = isClaimed || m.isDone({ gamification });
          return (
            <div
              key={m.id}
              className={cn(
                "flex items-center gap-3 rounded-xl bg-elevated px-3.5 py-3 transition-opacity",
                isClaimed && "opacity-60"
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isClaimed ? "done" : "pending"}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 18 }}
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    isClaimed ? "bg-teal-dim text-teal" : isDone ? "bg-gold-dim text-gold" : "bg-pressed text-muted"
                  )}
                >
                  {isClaimed ? (
                    <Check size={13} strokeWidth={3} />
                  ) : (
                    <span className="text-[10px] font-bold">{m.xp}</span>
                  )}
                </motion.span>
              </AnimatePresence>

              <div className="min-w-0 flex-1">
                <p className={cn("text-[14px] font-medium", isClaimed ? "text-secondary" : "text-primary")}>
                  {m.title}
                </p>
                <p className="text-[11px] leading-snug text-muted">{m.detail}</p>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {isClaimed ? (
                  <motion.span
                    key="done-label"
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="shrink-0 text-[12px] font-semibold text-teal"
                  >
                    Done
                  </motion.span>
                ) : isDone ? (
                  <motion.button
                    key="claim"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: [1, 1.05, 1] }}
                    transition={{ scale: { duration: 1.5, repeat: Infinity } }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => claim(m)}
                    className="shrink-0 rounded-lg fill-gold-gradient px-3 py-1.5 text-[12px] font-bold text-ink shadow-cta"
                  >
                    Claim +{m.xp}
                  </motion.button>
                ) : (
                  <motion.span
                    key="pending-xp"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="shrink-0 text-[11px] text-muted"
                  >
                    +{m.xp} XP
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AceSparkBurst() {
  const sparks = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    return { x: Math.cos(angle) * 90, y: Math.sin(angle) * 60 };
  });
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {sparks.map((s, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: s.x, y: s.y, opacity: 0, scale: 0.3 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="absolute h-1.5 w-1.5 rounded-full bg-gold"
        />
      ))}
    </div>
  );
}
