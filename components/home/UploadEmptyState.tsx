"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Loader2, Upload, PenLine, ChevronRight, AlertCircle } from "lucide-react";
import { analyzeBroker, analyzePositions, analyzeScreenshot } from "@/lib/api/portfolio";
import { ManualEntry, type ManualPosition } from "@/components/home/ManualEntry";
import { useCountUp } from "@/lib/hooks/useCountUp";
import type { Analysis } from "@/lib/analysis/types";

// fake-but-plausible slivers behind the lock — the curiosity gap, not just a label
const teasers = [
  { label: "Portfolio concentration check", stat: "6█% in one stock" },
  { label: "SIP overlap and waste detection", stat: "₹█,█00/yr overlapping" },
  { label: "Your real vs stated risk profile", stat: "█x riskier than you think" },
];

interface UploadEmptyStateProps {
  /** hand over a fetcher; the home state machine runs it during Processing */
  onStart: (fetcher: () => Promise<Analysis>) => void;
}

/**
 * STATE 1 — onboarding. Three ways in, so account-linking is never a wall:
 *   1. Link your broker (Account Aggregator — real, most accurate) — PRIMARY
 *   2. Upload a screenshot (Claude-vision OCR — no account needed)
 *   3. Enter positions manually (full control, no account)
 * All three produce an Analysis via the backend and converge on processing →
 * results. Backend down → the state machine falls back to demo analysis.
 */
export function UploadEmptyState({ onStart }: UploadEmptyStateProps) {
  const [view, setView] = useState<"choose" | "manual">("choose");
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scanCount = useCountUp(12431, 1400);

  const handleBroker = async () => {
    try {
      setLinking(true);
      setError(null);
      // run the consent flow up-front so a dead backend shows a real error
      const analysis = await analyzeBroker();
      onStart(() => Promise.resolve(analysis));
    } catch {
      setError("We couldn't reach your broker right now — try a screenshot or manual entry instead.");
      setLinking(false);
    }
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    onStart(() => analyzeScreenshot(file));
  };

  const handleManualSubmit = (positions: ManualPosition[]) => {
    const parsed = positions
      .map((p) => ({ ticker: p.ticker.trim(), qty: Number(p.qty), avg: Number(p.avg) }))
      .filter((p) => p.ticker && p.qty > 0 && p.avg > 0);
    try {
      localStorage.setItem("ants:manual-positions", JSON.stringify(parsed));
    } catch {
      // ignore persistence failures
    }
    onStart(() => analyzePositions(parsed));
  };

  if (view === "manual") {
    return <ManualEntry onBack={() => setView("choose")} onSubmit={handleManualSubmit} />;
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-base">
      <div className="mx-auto flex min-h-full max-w-app flex-col justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <p className="text-center text-[20px] font-extrabold text-gold">Ants</p>

          <h1 className="mt-6 text-center text-[28px] font-bold leading-[1.2] tracking-[-0.5px] text-primary">
            What is your portfolio
            <br />
            actually doing?
          </h1>

          <p className="mx-auto mt-3 max-w-[320px] text-center text-[15px] leading-[1.6] text-secondary">
            Connect your broker, upload a screenshot, or just type it in. We&apos;ll tell you the
            truth — not what you want to hear.
          </p>

          {/* hidden file input — screenshot goes to Claude-vision OCR */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {/* PRIMARY — link broker (real, most accurate). Solid gold, the hero action. */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={handleBroker}
            disabled={linking}
            className="mt-7 flex w-full animate-upload-breathe flex-col items-center gap-2 rounded-2xl fill-gold-gradient px-6 py-7 text-center shadow-cta transition-opacity disabled:opacity-70"
          >
            {linking ? (
              <Loader2 size={30} className="animate-spin text-ink" />
            ) : (
              <Lock size={30} strokeWidth={2.2} className="text-ink" />
            )}
            <span className="mt-1 text-[15px] font-bold text-ink">Link your broker</span>
            <span className="text-[12px] font-medium text-ink/70">
              Account Aggregator · real-time &amp; most accurate
            </span>
          </motion.button>

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-dim px-3 py-2.5">
              <AlertCircle size={16} className="shrink-0 text-red" />
              <p className="text-[12px] leading-snug text-red">{error}</p>
            </div>
          )}

          {/* divider */}
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] uppercase tracking-[0.8px] text-muted">or skip the linking</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {/* SECONDARY — no-account paths */}
          <div className="space-y-2.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => fileRef.current?.click()}
              className="group flex w-full items-center gap-3 rounded-2xl border border-subtle bg-gradient-to-b from-white/[0.04] to-transparent bg-surface px-4 py-3.5 text-left transition-colors hover:border-strong hover:bg-elevated"
            >
              <Upload size={20} strokeWidth={2.2} className="shrink-0 text-gold" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-primary">Upload a screenshot</span>
                <span className="block text-[12px] text-muted">AI reads it · Groww · Zerodha · Kuvera</span>
              </span>
              <ChevronRight
                size={18}
                className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
              />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setView("manual")}
              className="group flex w-full items-center gap-3 rounded-2xl border border-subtle bg-gradient-to-b from-white/[0.04] to-transparent bg-surface px-4 py-3.5 text-left transition-colors hover:border-strong hover:bg-elevated"
            >
              <PenLine size={20} strokeWidth={2.2} className="shrink-0 text-gold" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-primary">Enter positions manually</span>
                <span className="block text-[12px] text-muted">Type in what you hold — no account needed</span>
              </span>
              <ChevronRight
                size={18}
                className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
              />
            </motion.button>
          </div>

          <p className="mt-5 text-center text-[11px] text-muted">
            🔒 Your data stays on your device. We don&apos;t store screenshots.
          </p>

          {/* social proof — momentum, not a dead line */}
          <p className="mt-3 text-center text-[12px] text-secondary">
            🐜 <span className="font-bold tabular text-primary">{Math.round(scanCount).toLocaleString("en-IN")}</span>{" "}
            portfolios analyzed · avg 3 problems found
          </p>

          {/* locked teasers — a sliver of the prize behind each lock */}
          <div className="mt-7 space-y-2.5">
            {teasers.map((t) => (
              <motion.button
                key={t.label}
                type="button"
                whileTap={{ x: [0, -3, 3, -2, 0] }}
                transition={{ duration: 0.3 }}
                onClick={() => fileRef.current?.click()}
                className="flex h-14 w-full items-center justify-between rounded-2xl border border-subtle bg-surface px-4 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-secondary">{t.label}</span>
                  <span className="block select-none truncate text-[11px] text-muted blur-[3px]">
                    {t.stat}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-gold">
                  <Lock size={14} />
                  Unlock
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
