"use client";

import { motion } from "framer-motion";
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
}

/**
 * One holding as a full-width list item. No divider lines — whitespace and the
 * weight bar do the work. Winners are the most saturated.
 */
export function HoldingRow({ holding, weight, intensity }: HoldingRowProps) {
  const positive = holding.returnPct >= 0;

  return (
    <motion.div whileTap={{ scale: 0.98 }} className="select-none py-3.5">
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
      <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className={cn("h-full rounded-full", positive ? "bg-teal" : "bg-red")}
          style={{ width: `${Math.max(weight * 100, 3)}%`, opacity: 0.2 + intensity * 0.8 }}
        />
      </div>
    </motion.div>
  );
}
