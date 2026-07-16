"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "./Badge";
import type { ComputedHolding } from "@/lib/data/mock";
import { formatINR } from "@/lib/utils/formatINR";
import { formatPercent } from "@/lib/utils/formatPercent";
import { cn } from "@/lib/utils/cn";

interface HoldingRowProps {
  holding: ComputedHolding;
  /** 0..1 — share of the portfolio, drives bar width */
  weight: number;
  /** 0..1 — gain magnitude relative to the biggest mover, drives bar colour */
  intensity: number;
  /** stagger index for the weight-bar fill animation */
  index?: number;
}

/**
 * One holding as a full-width list item. No divider lines — whitespace and the
 * weight bar do the work. Winners are the most saturated. Tapping a row
 * expands a small detail line — avg vs current price and portfolio weight —
 * so the row isn't a dead end.
 */
export function HoldingRow({ holding, weight, intensity, index = 0 }: HoldingRowProps) {
  const [open, setOpen] = useState(false);
  const positive = holding.returnPct >= 0;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={() => setOpen((v) => !v)}
      className="block w-full select-none py-3.5 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        {/* left: name + sector + sub-line */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[16px] font-semibold text-primary">{holding.name}</span>
            <Badge tone="neutral" size="sm">{holding.sector}</Badge>
          </div>
          <p className="mt-1 text-[12px] text-muted">
            {holding.shares} {holding.unit} · avg {formatINR(holding.avg)}
          </p>
        </div>

        {/* right: current value + return % */}
        <div className="shrink-0 text-right">
          <p className="text-[16px] font-semibold text-primary tabular">{formatINR(holding.value)}</p>
          <p className={cn("text-[14px] font-semibold tabular", positive ? "text-teal" : "text-red")}>
            {formatPercent(holding.returnPct)}
          </p>
        </div>
      </div>

      {/* weight bar — width = portfolio weight, colour intensity = gain magnitude */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(weight * 100, 3)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22, delay: 0.1 + index * 0.04 }}
          className={cn("h-full rounded-full", positive ? "bg-teal" : "bg-red")}
          style={{ opacity: 0.3 + intensity * 0.7 }}
        />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface p-3">
              <div>
                <p className="text-[10px] uppercase text-muted">Avg</p>
                <p className="mt-0.5 text-[13px] font-semibold text-secondary tabular">
                  {formatINR(holding.avg)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted">CMP</p>
                <p className="mt-0.5 text-[13px] font-semibold text-primary tabular">
                  {formatINR(holding.cmp)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted">Weight</p>
                <p className="mt-0.5 text-[13px] font-semibold text-gold tabular">
                  {(weight * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
