"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AnalysisHolding } from "@/lib/analysis/types";
import { computeSectorMetrics } from "@/lib/insights/sectorMetrics";
import { Card } from "@/components/ui/Card";
import { formatPercent } from "@/lib/utils/formatPercent";
import { formatINR } from "@/lib/utils/formatINR";
import { cn } from "@/lib/utils/cn";

interface SectorHeatMapProps {
  holdings: AnalysisHolding[];
}

/** teal = gains, red = losses, amber = roughly flat — colors never cross roles */
function tileTextClass(returnPct: number): string {
  if (returnPct >= 2) return "text-teal";
  if (returnPct <= -2) return "text-red";
  return "text-amber";
}

/** heat scales with magnitude — a +40% sector and a +2% sector don't look the same */
function tileBackground(returnPct: number): string {
  const magnitude = Math.min(Math.abs(returnPct) / 25, 1); // saturates around ±25%
  const alpha = 0.12 + magnitude * 0.28; // 12% → 40%
  if (returnPct >= 2) return `rgba(0, 214, 158, ${alpha})`;
  if (returnPct <= -2) return `rgba(255, 92, 92, ${alpha})`;
  return "rgba(255, 176, 32, 0.16)";
}

/**
 * Sector heat map — the portfolio as a mosaic. Tile width = portfolio weight,
 * color = money-weighted sector return. Tap a tile to drill into its holdings.
 * Computed entirely from the live analysis; no extra API call.
 */
export function SectorHeatMap({ holdings }: SectorHeatMapProps) {
  const sectors = useMemo(() => computeSectorMetrics(holdings), [holdings]);
  const [selected, setSelected] = useState<string | null>(null);

  // split into two rows balanced by cumulative weight, so tiles stay tappable
  const { topRow, bottomRow } = useMemo(() => {
    if (sectors.length <= 3) return { topRow: sectors, bottomRow: [] as typeof sectors };
    const top: typeof sectors = [];
    let acc = 0;
    const total = sectors.reduce((s, x) => s + x.weight_pct, 0);
    for (const s of sectors) {
      if (acc >= total / 2 && top.length > 0) break;
      top.push(s);
      acc += s.weight_pct;
    }
    return { topRow: top, bottomRow: sectors.slice(top.length) };
  }, [sectors]);

  const selectedHoldings = selected
    ? holdings.filter((h) => h.sector === selected).sort((a, b) => b.value - a.value)
    : [];

  if (sectors.length === 0) return null;

  const renderRow = (row: typeof sectors, tall: boolean) => (
    <div className="flex gap-1.5">
      {row.map((s) => (
        <motion.button
          key={s.sector}
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.02, filter: "brightness(1.15)" }}
          onClick={() => setSelected(selected === s.sector ? null : s.sector)}
          style={{ flexGrow: Math.max(s.weight_pct, 8), background: tileBackground(s.return_pct) }}
          className={cn(
            "min-w-0 basis-0 overflow-hidden rounded-xl px-2.5 py-2 text-left transition-shadow",
            tall ? "h-24" : "h-[72px]",
            tileTextClass(s.return_pct),
            selected === s.sector && "ring-2 ring-gold"
          )}
        >
          <p className="truncate text-[12px] font-bold">{s.sector}</p>
          <p className="mt-0.5 text-[11px] font-semibold opacity-80 tabular">
            {s.weight_pct.toFixed(0)}%
          </p>
          <p className="text-[11px] font-bold tabular">{formatPercent(s.return_pct)}</p>
        </motion.button>
      ))}
    </div>
  );

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[15px] font-semibold text-primary">Sector heat map</p>
        <p className="text-[11px] text-muted">size = weight · color = return · tap a tile ↓</p>
      </div>

      <div className="space-y-1.5">
        {renderRow(topRow, true)}
        {bottomRow.length > 0 && renderRow(bottomRow, false)}
      </div>

      {/* drill-down: holdings inside the tapped sector */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-2.5 border-t border-subtle pt-4">
              {selectedHoldings.map((h) => (
                <div key={h.ticker} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-primary">{h.name}</p>
                    <p className="text-[11px] text-muted">
                      {formatINR(h.value)} · {h.weightPct.toFixed(1)}% of portfolio
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-[13px] font-bold tabular",
                      h.returnPct >= 0 ? "text-teal" : "text-red"
                    )}
                  >
                    {formatPercent(h.returnPct)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/**
 * Sector performance list — every sector ranked by weight with a thin weight
 * bar, return and volatility. The "table view" companion to the heat map.
 */
export function SectorPerformance({ holdings }: SectorHeatMapProps) {
  const sectors = useMemo(() => computeSectorMetrics(holdings), [holdings]);
  if (sectors.length === 0) return null;

  const maxWeight = Math.max(...sectors.map((s) => s.weight_pct));

  return (
    <Card>
      <p className="mb-4 text-[15px] font-semibold text-primary">Sector breakdown</p>
      <div className="space-y-3.5">
        {sectors.map((s, i) => (
          <div key={s.sector}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 truncate text-[13px] font-medium text-primary">
                {s.sector}
                <span className="ml-1.5 text-[11px] text-muted">
                  {s.holdings_count} holding{s.holdings_count > 1 ? "s" : ""}
                </span>
              </p>
              <div className="flex shrink-0 items-baseline gap-3">
                <span className="text-[11px] text-muted tabular">{s.weight_pct.toFixed(1)}%</span>
                <span
                  className={cn(
                    "w-14 text-right text-[13px] font-bold tabular",
                    s.return_pct >= 0 ? "text-teal" : "text-red"
                  )}
                >
                  {formatPercent(s.return_pct)}
                </span>
              </div>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-elevated">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(s.weight_pct / maxWeight) * 100}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 22, delay: 0.1 + i * 0.05 }}
                className={cn("h-full rounded-full", s.return_pct >= 0 ? "bg-teal" : "bg-red")}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
