"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { checkTip, type TipCheckResult } from "@/lib/api/portfolio";
import type { Analysis } from "@/lib/analysis/types";
import { cn } from "@/lib/utils/cn";

const toneStyles: Record<TipCheckResult["tone"], { border: string; text: string; headline: string }> = {
  ok: { border: "border-teal", text: "text-teal", headline: "Clear-ish." },
  caution: { border: "border-amber", text: "text-amber", headline: "Eyes open." },
  warn: { border: "border-red", text: "text-red", headline: "Hold up." },
};

/**
 * Tip Check — the pre-buy gut check. Paste the ticker someone tipped you and
 * get what buying it actually does to YOUR portfolio, before the money moves.
 * Facts + tone come from the engine; the verdict is the Ants voice.
 */
export function TipCheck({ analysis }: { analysis: Analysis }) {
  const [ticker, setTicker] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TipCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = ticker.trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    try {
      const positions = analysis.holdings.map((h) => ({ ticker: h.ticker, qty: h.qty, avg: h.avg }));
      setResult(await checkTip(t, positions));
    } catch {
      setResult(null);
      setError("Tip Check needs the backend — start it and try again.");
    } finally {
      setBusy(false);
    }
  };

  const tone = result ? toneStyles[result.tone] : null;

  return (
    <Card>
      <SectionLabel>Before you buy</SectionLabel>
      <p className="mt-1.5 text-[16px] font-semibold text-primary">
        Got a tip? Run it past Ants first.
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-secondary">
        WhatsApp uncle, YouTube guru, office friend — paste the ticker before the money moves.
      </p>

      <form onSubmit={submit} className="mt-4 flex items-center gap-2">
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="e.g. SUZLON"
          aria-label="Ticker to check"
          className="min-w-0 flex-1 rounded-xl border border-subtle bg-pressed px-3.5 py-2.5 text-[15px] uppercase text-primary outline-none placeholder:normal-case placeholder:text-muted focus:border-strong"
        />
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="submit"
          disabled={busy || !ticker.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gold px-4 py-2.5 text-[14px] font-bold text-ink disabled:opacity-40"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} strokeWidth={2.6} />}
          Check
        </motion.button>
      </form>

      {error && <p className="mt-3 text-[12px] text-red">{error}</p>}

      <AnimatePresence mode="wait">
        {result && tone && (
          <motion.div
            key={result.ticker + result.verdict.slice(0, 12)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className={cn("mt-4 border-l-[3px] pl-3.5", tone.border)}
          >
            <p className={cn("text-[15px] font-bold", tone.text)}>{tone.headline}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-secondary">{result.verdict}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {result.known && result.sector && (
                <Badge tone="neutral" size="sm">
                  {result.sector}
                </Badge>
              )}
              {result.known && result.sectorWeightNow !== null && result.sectorWeightAfter !== null && (
                <Badge tone={result.tone === "ok" ? "gain" : "warn"} size="sm">
                  <span className="tabular">
                    {result.sectorWeightNow}% → {result.sectorWeightAfter}%
                  </span>
                </Badge>
              )}
              {result.alreadyOwnWeightPct !== null && (
                <Badge tone="gold" size="sm">
                  <span className="tabular">You own {result.alreadyOwnWeightPct}%</span>
                </Badge>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
