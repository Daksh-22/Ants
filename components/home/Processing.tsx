"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

const STEPS = [
  "Reading your positions…",
  "Pricing against the market…",
  "Stress-testing for concentration…",
  "Writing the truth…",
];

// uneven gaps read as real computation, not a metronome
const GAPS = [650, 950, 1150];

interface ProcessingProps {
  onDone: () => void;
  /** resolves when the real analysis is ready — the last step waits for it */
  waitFor?: Promise<unknown>;
}

/**
 * The mocked-OCR screen. The first three steps run on a fixed, uneven script;
 * the FINAL step never checks off — and the screen never fades — until the
 * real `waitFor` promise resolves. If the backend is slow, the user watches a
 * spinner with copy, never a blank black screen.
 */
export function Processing({ onDone, waitFor }: ProcessingProps) {
  const [visible, setVisible] = useState(0); // how many steps have appeared
  const [checked, setChecked] = useState(0); // how many steps are checked
  const [ready, setReady] = useState(!waitFor);
  const [fading, setFading] = useState(false);
  const [tease, setTease] = useState(false);
  const doneRef = useRef(false);
  const advancedRef = useRef(false);

  // scripted reveal of the first three steps
  useEffect(() => {
    const timers = [
      setTimeout(() => setVisible(1), 60),
      setTimeout(() => setChecked(1), GAPS[0]),
      setTimeout(() => setVisible(2), GAPS[0] + 80),
      setTimeout(() => setChecked(2), GAPS[0] + GAPS[1]),
      setTimeout(() => setVisible(3), GAPS[0] + GAPS[1] + 80),
      setTimeout(() => setChecked(3), GAPS[0] + GAPS[1] + GAPS[2]),
      setTimeout(() => setVisible(4), GAPS[0] + GAPS[1] + GAPS[2] + 80),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // the real work — never lets the screen go blank while it's in flight
  useEffect(() => {
    if (!waitFor) return;
    waitFor.finally(() => setReady(true)).catch(() => setReady(true));
  }, [waitFor]);

  // step 4 only checks off once BOTH the script has caught up AND data is
  // ready. Guarded by a ref (not `checked` itself) — putting `checked` in the
  // dependency array would let this same effect's own setChecked(4) trigger a
  // re-run whose cleanup cancels t1/t2 before they ever fire.
  useEffect(() => {
    if (visible < 4 || !ready || advancedRef.current) return;
    advancedRef.current = true;
    setChecked(4);
    setTease(true);
    const t1 = setTimeout(() => setFading(true), 900);
    const t2 = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    }, 1150);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [visible, ready]);

  return (
    <motion.div
      animate={{ opacity: fading ? 0 : 1 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-40 overflow-y-auto bg-base"
    >
      <div className="mx-auto flex min-h-full max-w-app flex-col justify-center px-8">
        <p className="mb-3 text-center text-[20px] font-extrabold text-gold">Ants</p>

        {/* determinate-feeling progress bar under the wordmark */}
        <div className="mx-auto mb-8 h-[3px] w-40 overflow-hidden rounded-full bg-elevated">
          <motion.div
            className="h-full rounded-full fill-gold-gradient shadow-glow-gold"
            initial={{ width: "0%" }}
            animate={{ width: `${(checked / STEPS.length) * 100}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
          />
        </div>

        <ul className="space-y-5">
          {STEPS.map((label, i) => {
            const shown = i < visible;
            const done = i < checked;
            const spinningOnData = i === 3 && shown && !done;
            return (
              <motion.li
                key={label}
                initial={false}
                animate={{ opacity: shown ? 1 : 0.2, x: shown ? 0 : -8 }}
                transition={{ type: "spring", stiffness: 280, damping: 24 }}
                className="flex items-center gap-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  {done ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 420, damping: 18 }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-dim"
                    >
                      <Check size={15} strokeWidth={3} className="text-gold" />
                    </motion.span>
                  ) : shown ? (
                    <Loader2 size={18} className="animate-spin text-gold" />
                  ) : null}
                </span>
                <span className="text-[16px] font-medium text-primary">{label}</span>
                {spinningOnData && (
                  <span className="text-[12px] text-muted">taking a moment…</span>
                )}
              </motion.li>
            );
          })}
        </ul>

        {tease && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-7 text-center text-[15px] font-semibold text-gold"
          >
            Found a few things you won&apos;t like…
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
