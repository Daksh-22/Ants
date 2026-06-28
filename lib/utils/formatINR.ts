/**
 * Format a number as an Indian-style rupee amount.
 *   formatINR(187420)               -> "₹1,87,420"
 *   formatINR(1240, { signed: true }) -> "+₹1,240"
 *   formatINR(-500, { signed: true }) -> "-₹500"
 *
 * Uses the en-IN locale so grouping follows the Indian convention
 * (last 3 digits, then groups of 2) — ₹1,87,420, never ₹187,420.
 */
export function formatINR(
  amount: number,
  opts: { signed?: boolean; decimals?: number } = {}
): string {
  const { signed = false, decimals = 0 } = opts;
  const negative = amount < 0;
  const abs = Math.abs(amount);

  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(abs);

  const sign = negative ? "-" : signed ? "+" : "";
  return `${sign}₹${formatted}`;
}
