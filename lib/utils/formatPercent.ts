/**
 * Format a percentage with a leading "+" for positive values.
 *   formatPercent(21.7)  -> "+21.7%"
 *   formatPercent(-3.2)  -> "-3.2%"
 *   formatPercent(0)     -> "0.0%"
 */
export function formatPercent(value: number, opts: { decimals?: number } = {}): string {
  const { decimals = 1 } = opts;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}
