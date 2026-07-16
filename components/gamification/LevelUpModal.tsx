"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppState } from "@/components/app/AppState";
import { getLevelBandName } from "@/lib/gamification/xpSystem";
import { useCountUp } from "@/lib/hooks/useCountUp";

const SEEN_LEVEL_KEY = "ants:last-seen-level";

/**
 * Level-up celebration — full-screen moment when the level climbs past the
 * last one the user has SEEN (persisted, so it fires once per level, not once
 * per render). The level number rolls from the old value to the new one —
 * the journey, not just the destination. Gold burst, one tap to dismiss.
 */
export function LevelUpModal() {
  const { gamification, hydrated } = useAppState();
  const [show, setShow] = useState(false);
  const [fromLevel, setFromLevel] = useState(gamification.level);
  const displayLevel = useCountUp(show ? gamification.level : fromLevel, 900);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const seen = parseInt(localStorage.getItem(SEEN_LEVEL_KEY) ?? "1", 10) || 1;
      if (gamification.level > seen) {
        setFromLevel(seen);
        setShow(true);
        localStorage.setItem(SEEN_LEVEL_KEY, String(gamification.level));
      } else if (gamification.level < seen) {
        // state was reset/imported — resync quietly, no celebration
        localStorage.setItem(SEEN_LEVEL_KEY, String(gamification.level));
      }
    } catch {
      // localStorage unavailable — skip the celebration
    }
  }, [gamification.level, hydrated]);

  // 12 gold sparks bursting outward — cheap confetti, no library
  const sparks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    return { x: Math.cos(angle) * 110, y: Math.sin(angle) * 110, delay: 0.15 + (i % 3) * 0.05 };
  });

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-8"
          onClick={() => setShow(false)}
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}
            className="card-sheen-elevated relative w-full max-w-[320px] rounded-3xl px-6 py-9 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ambient gold glow behind the trophy */}
            <div className="pointer-events-none absolute left-1/2 top-10 h-40 w-40 -translate-x-1/2 rounded-full bg-gold/25 blur-3xl" />

            {/* spark burst */}
            <div className="pointer-events-none absolute left-1/2 top-16">
              {sparks.map((s, i) => (
                <motion.span
                  key={i}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ x: s.x, y: s.y, opacity: 0, scale: 0.3 }}
                  transition={{ duration: 0.9, delay: s.delay, ease: "easeOut" }}
                  className="absolute h-2 w-2 rounded-full bg-gold"
                />
              ))}
            </div>

            <motion.p
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
              className="relative text-6xl"
            >
              🏆
            </motion.p>

            <p className="relative mt-4 text-label uppercase text-muted">Level up</p>
            <p className="relative mt-1 text-display font-extrabold text-gradient-gold tabular">
              Lv {Math.round(displayLevel)}
            </p>
            <p className="relative mt-1 text-[15px] font-semibold text-primary">
              {getLevelBandName(gamification.level)}
            </p>
            <p className="relative mt-3 text-[13px] leading-relaxed text-secondary">
              {gamification.totalXpEarned.toLocaleString("en-IN")} XP earned all-time. Keep showing up.
            </p>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShow(false)}
              className="relative mt-6 w-full rounded-2xl fill-gold-gradient py-3.5 text-[14px] font-bold text-ink shadow-cta"
            >
              Keep climbing
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
