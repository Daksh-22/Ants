"use client";

import { forwardRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";
import { useAppState, type XpEvent } from "@/components/app/AppState";

/**
 * Global XP toast layer — every earnXp() anywhere in the app pops a gold
 * "+N XP" pill that springs up above the dock, holds a beat, and floats away.
 * The visible half of the reward loop: if XP moves, the user SEES it move.
 */
const Toast = forwardRef<HTMLDivElement, { event: XpEvent; onDone: () => void }>(
  function Toast({ event, onDone }, ref) {
    useEffect(() => {
      const t = setTimeout(onDone, 2000);
      return () => clearTimeout(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, y: 24, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -18, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
        className="glass pointer-events-none flex items-center gap-2 rounded-full py-2 pl-3 pr-4 shadow-glow-gold"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full fill-gold-gradient">
          <Zap size={13} strokeWidth={2.8} className="text-ink" fill="currentColor" />
        </span>
        <span className="text-[14px] font-extrabold text-gold tabular">+{event.amount} XP</span>
        {event.label && (
          <span className="max-w-[160px] truncate text-[12px] font-medium text-secondary">
            {event.label}
          </span>
        )}
      </motion.div>
    );
  }
);

export function XpToastLayer() {
  const { xpEvents, dismissXpEvent } = useAppState();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] mx-auto flex w-full max-w-app flex-col items-center gap-2 px-4">
      <AnimatePresence mode="popLayout">
        {xpEvents.map((e) => (
          <Toast key={e.id} event={e} onDone={() => dismissXpEvent(e.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
