"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Loader2, Upload, PenLine, ChevronRight } from "lucide-react";
import { analyzeBroker, analyzePositions, analyzeScreenshot } from "@/lib/api/portfolio";
import { ManualEntry, type ManualPosition } from "@/components/home/ManualEntry";
import type { Analysis } from "@/lib/analysis/types";

const teasers = [
  "Portfolio concentration check",
  "SIP overlap and waste detection",
  "Your real vs stated risk profile",
];

interface UploadEmptyStateProps {
  /** hand over a fetcher; the home state machine runs it during Processing */
  onStart: (fetcher: () => Promise<Analysis>) => void;
}

/**
 * STATE 1 — onboarding. Three ways in, so account-linking is never a wall:
 *   1. Link your broker (Account Aggregator — real, most accurate)
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

  const handleBroker = async () => {
    try {
      setLinking(true);
      setError(null);
      // run the consent flow up-front so a dead backend shows a real error
      const analysis = await analyzeBroker();
      onStart(() => Promise.resolve(analysis));
    } catch {
      setError("Couldn't reach the backend (uvicorn on :8000). Try a screenshot or manual entry.");
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

          {/* PRIMARY — link broker (real, most accurate) */}
          <button
            type="button"
            onClick={handleBroker}
            disabled={linking}
            className="mt-7 flex w-full animate-upload-breathe flex-col items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-gold-soft bg-gold-faint px-6 py-7 text-center transition-opacity disabled:opacity-60"
          >
            {linking ? (
              <Loader2 size={30} className="animate-spin text-gold" />
            ) : (
              <Lock size={30} strokeWidth={2.2} className="text-gold" />
            )}
            <span className="mt-1 text-[15px] font-semibold text-primary">Link your broker</span>
            <span className="text-[12px] text-muted">Account Aggregator · real-time &amp; most accurate</span>
          </button>

          {error && <p className="mt-2 text-center text-[12px] text-red">{error}</p>}

          {/* divider */}
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] uppercase tracking-[0.8px] text-muted">or skip the linking</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {/* SECONDARY — no-account paths */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left active:scale-[0.99]"
            >
              <Upload size={20} strokeWidth={2.2} className="shrink-0 text-gold" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-primary">Upload a screenshot</span>
                <span className="block text-[12px] text-muted">AI reads it · Groww · Zerodha · Kuvera</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-muted" />
            </button>

            <button
              type="button"
              onClick={() => setView("manual")}
              className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left active:scale-[0.99]"
            >
              <PenLine size={20} strokeWidth={2.2} className="shrink-0 text-gold" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-primary">Enter positions manually</span>
                <span className="block text-[12px] text-muted">Type in what you hold — no account needed</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-muted" />
            </button>
          </div>

          <p className="mt-5 text-center text-[11px] text-muted">
            🔒 Your data stays on your device. We don&apos;t store screenshots.
          </p>

          {/* locked teasers — show the value before they commit */}
          <div className="mt-7 space-y-2.5">
            {teasers.map((label) => (
              <div
                key={label}
                className="flex h-14 items-center justify-between rounded-2xl bg-surface px-4 opacity-50"
              >
                <span className="text-[14px] font-medium text-secondary">{label}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted">
                  <Lock size={14} className="text-gold" />
                  Locked
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
