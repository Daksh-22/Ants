"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BASE_SCORE, FIXES, type Fix } from "@/components/home/fixes";

interface FixSheetProps {
  fix: Fix;
  /** ids already done — to compute the live "before" score and this fix's done state */
  doneFixes: string[];
  onClose: () => void;
  onMarkDone: (id: string) => void;
}

const sumDeltas = (ids: string[]) =>
  FIXES.filter((f) => ids.includes(f.id)).reduce((s, f) => s + f.scoreDelta, 0);

/**
 * Bottom sheet for a single fix: the problem, the steps, and a concrete
 * before→after — both the headline metric and the health score it unlocks.
 * "Mark as done" applies it; the reward (ring climb + gold pulse) plays on the
 * results screen behind the closing sheet.
 */
export function FixSheet({ fix, doneFixes, onClose, onMarkDone }: FixSheetProps) {
  const done = doneFixes.includes(fix.id);
  const currentScore = Math.min(100, BASE_SCORE + sumDeltas(doneFixes));
  const projectedScore = Math.min(100, currentScore + (done ? 0 : fix.scoreDelta));

  return (
    <>
      {/* backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-black/60"
      />

      {/* sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-app rounded-t-3xl bg-elevated px-6 pb-8 pt-3"
      >
        {/* grab handle */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-strong" />

        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[20px] font-bold leading-tight text-primary">{fix.sheetTitle}</h3>
          <button onClick={onClose} aria-label="Close" className="-m-1 p-1 text-muted">
            <X size={20} strokeWidth={2.4} />
          </button>
        </div>

        {/* before → after */}
        <div className="mt-4 rounded-2xl bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-label uppercase text-muted">{fix.metricLabel}</p>
              <p className="mt-1 text-[18px] font-bold text-secondary line-through tabular">
                {fix.metricBefore}
              </p>
            </div>
            <ArrowRight size={18} className="text-muted" />
            <div className="text-right">
              <p className="text-label uppercase text-teal">After</p>
              <p className="mt-1 text-[22px] font-extrabold text-teal tabular">{fix.metricAfter}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-subtle pt-3 text-[13px]">
            <span className="text-muted">Health score</span>
            <span className="flex items-center gap-1.5 font-bold text-primary tabular">
              {currentScore}
              <ArrowRight size={12} className="text-muted" />
              <span className="text-gold">{projectedScore}</span>
            </span>
          </div>
        </div>

        {/* steps */}
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

        {/* action */}
        {done ? (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-teal-dim py-3.5 text-[15px] font-bold text-teal">
            <Check size={17} strokeWidth={3} />
            Done — nice work
          </div>
        ) : (
          <Button className="mt-5 w-full" onClick={() => onMarkDone(fix.id)}>
            Mark as done
          </Button>
        )}
      </motion.div>
    </>
  );
}
