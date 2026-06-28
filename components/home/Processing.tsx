"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

// personalized to Arjun's portfolio — feels like it's really reading your holdings
const STEPS: { label: string; detail: string }[] = [
  { label: "Reading your holdings", detail: "7 found" },
  { label: "Spotting concentration", detail: "HDFC + Reliance" },
  { label: "Checking SIP overlap", detail: "Mirae × Quant" },
  { label: "Building your breakdown", detail: "" },
];

/**
 * The ~2.4s mocked-OCR screen. Steps reveal in sequence, each earning a gold
 * checkmark and a personalized detail, then it fades and reveals the results.
 */
export function Processing({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(0); // how many steps have appeared
  const [checked, setChecked] = useState(0); // how many steps are checked
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setVisible(1), 60),
      setTimeout(() => setChecked(1), 460),
      setTimeout(() => setVisible(2), 560),
      setTimeout(() => setChecked(2), 960),
      setTimeout(() => setVisible(3), 1060),
      setTimeout(() => setChecked(3), 1460),
      setTimeout(() => setVisible(4), 1560),
      setTimeout(() => setChecked(4), 1960),
      setTimeout(() => setFading(true), 2200),
      setTimeout(onDone, 2400),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      animate={{ opacity: fading ? 0 : 1 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-40 overflow-y-auto bg-base"
    >
      <div className="mx-auto flex min-h-full max-w-app flex-col justify-center px-8">
        <p className="mb-8 text-center text-[20px] font-extrabold text-gold">Ants</p>
        <ul className="space-y-5">
          {STEPS.map((step, i) => {
            const shown = i < visible;
            const done = i < checked;
            return (
              <motion.li
                key={step.label}
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
                <span className="text-[16px] font-medium text-primary">{step.label}</span>
                {done && step.detail && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[13px] text-muted"
                  >
                    {step.detail}
                  </motion.span>
                )}
              </motion.li>
            );
          })}
        </ul>
      </div>
    </motion.div>
  );
}
