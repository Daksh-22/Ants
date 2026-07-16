import type { AnalysisHolding } from "@/lib/analysis/types";
import type { SectorMetrics } from "@/lib/insights/types";

// Sector volatility baselines (annualized %) — mirrors backend/metrics.py
const SECTOR_VOLATILITY: Record<string, number> = {
  IT: 22.5,
  Banking: 20.0,
  "NBFC/Finance": 24.0,
  Energy: 28.0,
  Power: 18.5,
  Electronics: 26.0,
  Defense: 19.0,
  Railways: 17.0,
  Auto: 25.0,
  FMCG: 16.0,
  Pharma: 21.0,
  "Consumer Tech": 35.0,
  Conglomerate: 23.0,
};

/**
 * Aggregate holdings into per-sector metrics, computed from the live analysis.
 * Sector return is money-weighted: (Σ value − Σ invested) / Σ invested.
 * Sorted by portfolio weight, heaviest first.
 */
export function computeSectorMetrics(holdings: AnalysisHolding[]): SectorMetrics[] {
  const bySector = new Map<string, { value: number; invested: number; weight: number; count: number }>();

  for (const h of holdings) {
    const entry = bySector.get(h.sector) ?? { value: 0, invested: 0, weight: 0, count: 0 };
    entry.value += h.value;
    entry.invested += h.invested;
    entry.weight += h.weightPct;
    entry.count += 1;
    bySector.set(h.sector, entry);
  }

  const metrics: SectorMetrics[] = [...bySector.entries()].map(([sector, e]) => ({
    sector,
    holdings_count: e.count,
    weight_pct: e.weight,
    return_pct: e.invested > 0 ? ((e.value - e.invested) / e.invested) * 100 : 0,
    volatility_pct: SECTOR_VOLATILITY[sector] ?? 22.0,
  }));

  return metrics.sort((a, b) => b.weight_pct - a.weight_pct);
}
