"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCountUp } from "@/lib/hooks/useCountUp";
import type { FixPlan } from "@/lib/analysis/types";

interface FixSheetProps {
  fix: FixPlan;
  /** live score before applying this fix */
  currentScore: number;
  /** score once this fix is done */
  projectedScore: number;
  done: boolean;
  onClose: () => void;
  onMarkDone: (id: string) => void;
}

const SPARK_COUNT = 10;

/**
 * Bottom sheet for a single fix: the problem, the steps, and a concrete
 * before→after — both the headline metric and the health score it unlocks.
 * Marking done plays a real celebration before the sheet closes: the score
 * counts up live, a gold spark burst fires, and a haptic tick lands — the
 * app's best persuasion asset gets a payoff worth persuading for.
 */
export function FixSheet({ fix, currentScore, projectedScore, done, onClose, onMarkDone }: FixSheetProps) {
  const [celebrating, setCelebrating] = useState(false);
  const liveScore = useCountUp(celebrating ? projectedScore : currentScore, 700);

  const handleMarkDone = () => {
    setCelebrating(true);
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([15, 40, 15]);
    } catch {
      // not supported
    }
    setTimeout(() => onMarkDone(fix.id), 750);
  };

  return (
    <>
      {/* backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={celebrating ? undefined : onClose}
        className="fixed inset-0 z-[60] bg-black/60"
      />

      {/* sheet */}
      <motion.div
        drag={celebrating ? false : "y"}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 600) onClose();
        }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-h-[88vh] w-full max-w-app flex-col overflow-hidden rounded-t-3xl bg-elevated"
      >
        <div className="overflow-y-auto px-6 pb-8 pt-3">
          {/* grab handle */}
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-strong" />

          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[20px] font-bold leading-tight text-primary">{fix.sheetTitle}</h3>
            {!celebrating && (
              <button onClick={onClose} aria-label="Close" className="-m-1 p-1 text-muted">
                <X size={20} strokeWidth={2.4} />
              </button>
            )}
          </div>

          {/* before → after */}
          <div className="relative mt-4 overflow-hidden rounded-2xl bg-surface p-4">
            {celebrating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1.1 }}
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-teal/15 to-transparent"
              />
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-label uppercase text-muted">{fix.metricLabel}</p>
                <p
                  className={`mt-1 text-[18px] font-bold tabular ${
                    celebrating ? "text-muted line-through opacity-60" : "text-secondary line-through"
                  }`}
                >
                  {fix.metricBefore}
                </p>
              </div>
              <ArrowRight size={18} className="text-muted" />
              <div className="text-right">
                <p className="text-label uppercase text-teal">After</p>
                <motion.p
                  animate={celebrating ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.5 }}
                  className="mt-1 text-[22px] font-extrabold text-teal tabular"
                >
                  {fix.metricAfter}
                </motion.p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-subtle pt-3 text-[13px]">
              <span className="text-muted">Health score</span>
              <span className="flex items-center gap-1.5 font-bold tabular">
                <span className="text-primary">{Math.round(liveScore)}</span>
                {!celebrating && (
                  <>
                    <ArrowRight size={12} className="text-muted" />
                    <span className="text-gold">{projectedScore}</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* steps */}
          {!celebrating && (
            <>
              <ol className="mt-5 space-y-3">
                {fix.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-dim text-[11px] font-bold text-gold tabular">
                      {i + 1}
                    </span>
                    <p className="text-[14px] leading-snug text-secondary">{step}</p>
                  </li>
                ))}
              </ol>

              <p className="mt-4 text-[12px] text-muted">{fix.effort}</p>
            </>
          )}

          {/* action / celebration */}
          {done ? (
            <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-teal-dim py-3.5 text-[15px] font-bold text-teal">
              <Check size={17} strokeWidth={3} />
              Done — nice work
            </div>
          ) : celebrating ? (
            <div className="relative mt-5 flex items-center justify-center gap-2 rounded-xl bg-teal-dim py-3.5 text-[15px] font-bold text-teal">
              <SparkBurst />
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 16 }}
              >
                <Check size={17} strokeWidth={3} />
              </motion.span>
              Nice work — sorted
            </div>
          ) : (
            <Button className="mt-5 w-full" onClick={handleMarkDone}>
              Mark as done
            </Button>
          )}
        </div>
      </motion.div>
    </>
  );
}

/** a small burst of gold sparks — same visual language as LevelUpModal */
function SparkBurst() {
  const sparks = Array.from({ length: SPARK_COUNT }, (_, i) => {
    const angle = (i / SPARK_COUNT) * Math.PI * 2;
    return { x: Math.cos(angle) * 60, y: Math.sin(angle) * 60 };
  });
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {sparks.map((s, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: s.x, y: s.y, opacity: 0, scale: 0.3 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="absolute h-1.5 w-1.5 rounded-full bg-gold"
        />
      ))}
    </div>
  );
}
