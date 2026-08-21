import type { AnalysisHolding } from "@/lib/analysis/types";
import type { SectorMetrics } from "@/lib/insights/types";

// NOTE: a SECTOR_VOLATILITY lookup table used to live here and feed the whole
// risk dashboard. Ten of the twenty-two sector labels the backend emits were
// missing from it, so most holdings silently took a 22.0% default and every
// risk number barely moved between portfolios. Real volatility now comes from
// GET /api/metrics, computed from a year of daily closes per ticker.

/**
 * Aggregate holdings into per-sector metrics, computed from the live analysis.
 * Sector return is money-weighted: (Σ value − Σ invested) / Σ invested.
 * Sorted by portfolio weight, heaviest first.
 */
export function computeSectorMetrics(holdings: AnalysisHolding[]): SectorMetrics[] {
  const bySector = new Map<
    string,
    { value: number; invested: number; weight: number; count: number; pricedCount: number }
  >();

  for (const h of holdings) {
    const entry =
      bySector.get(h.sector) ?? { value: 0, invested: 0, weight: 0, count: 0, pricedCount: 0 };

    // Weight always counts the holding: it is real money in that sector
    // regardless of whether we could price it.
    entry.weight += h.weightPct;
    entry.count += 1;

    // The RETURN must not. An unpriced holding is held at the user's own
    // average, so it contributes a fabricated exactly-0% leg that drags the
    // money-weighted sector return toward zero. Pharma with one holding up 50%
    // and one unpriced holding of equal size reported +25% — a number that
    // described neither holding. /portfolio already badges these "No price";
    // this screen was averaging them in as measured results.
    if (h.priceSource !== "unpriced") {
      entry.value += h.value;
      entry.invested += h.invested;
      entry.pricedCount += 1;
    }
    bySector.set(h.sector, entry);
  }

  const metrics: SectorMetrics[] = [...bySector.entries()].map(([sector, e]) => ({
    sector,
    holdings_count: e.count,
    priced_count: e.pricedCount,
    weight_pct: e.weight,
    return_pct: e.invested > 0 ? ((e.value - e.invested) / e.invested) * 100 : null,
  }));

  return metrics.sort((a, b) => b.weight_pct - a.weight_pct);
}
