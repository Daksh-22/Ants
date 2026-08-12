/**
 * How stale a cached analysis is, in words.
 *
 * The analysis is stored in localStorage and nothing re-prices it, so a
 * returning user's holdings carry whatever quote was fetched when they last
 * ran it. The UI claimed "Live prices · all N holdings" over those numbers
 * regardless of age, which is the kind of small lie that costs more trust than
 * the feature was worth.
 */
export function describeFreshness(iso?: string): { label: string; stale: boolean } {
  if (!iso) return { label: "Prices from your last scan", stale: true };

  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return { label: "Prices from your last scan", stale: true };

  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 2) return { label: "Live prices", stale: false };
  if (mins < 60) return { label: `Prices from ${mins} min ago`, stale: mins > 20 };

  const hours = Math.round(mins / 60);
  if (hours < 24) return { label: `Prices from ${hours}h ago`, stale: true };

  const days = Math.round(hours / 24);
  return { label: `Prices from ${days} day${days > 1 ? "s" : ""} ago`, stale: true };
}
