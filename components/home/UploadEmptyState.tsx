"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Loader2, Upload, PenLine, ChevronRight, AlertCircle } from "lucide-react";
import {
  analyzePositions,
  extractHoldingsFromScreenshot,
  type RawPosition,
} from "@/lib/api/portfolio";
import { ManualEntry, type ManualPosition } from "@/components/home/ManualEntry";
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
  /** open straight into the entry form, pre-filled — the "edit holdings" path */
  startInManualEntry?: boolean;
  /** present only while editing: returns to the existing results */
  onExitEdit?: () => void;
}

/**
 * STATE 1 — onboarding. Two ways in, neither of which needs an account:
 *   1. Upload a screenshot (OCR → editable review)
 *   2. Enter positions manually (full control)
 *
 * Broker linking (Account Aggregator) is deliberately absent — it needs a
 * licensed aggregator and an RBI FIU registration, and shipping a button that
 * returned demo data cost more trust than the missing feature does. It comes
 * back when it actually connects.
 *
 * Screenshots deliberately do NOT go straight to an analysis: OCR is a guess,
 * so the extracted rows land in the manual-entry form for the user to confirm
 * or correct first. That way an imperfect read still produces a real,
 * personal analysis instead of silently showing demo numbers.
 */
const SAVED_POSITIONS_KEY = "ants:manual-positions";

/** Last submitted positions, so the form can restore instead of starting blank. */
function readSavedPositions(): RawPosition[] {
  try {
    const raw = localStorage.getItem(SAVED_POSITIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is RawPosition =>
        !!p &&
        typeof (p as RawPosition).ticker === "string" &&
        Number((p as RawPosition).qty) > 0 &&
        Number((p as RawPosition).avg) > 0
    );
  } catch {
    return [];
  }
}

export function UploadEmptyState({
  onStart,
  startInManualEntry = false,
  onExitEdit,
}: UploadEmptyStateProps) {
  const [view, setView] = useState<"choose" | "manual" | "review">(
    startInManualEntry ? "manual" : "choose"
  );
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<RawPosition[]>([]);
  const [reviewNote, setReviewNote] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      const result = await extractHoldingsFromScreenshot(file);
      if (result.holdings.length === 0) {
        setError(
          result.note ||
            "Couldn't read any holdings from that screenshot. Try a clearer, cropped photo — or type them in."
        );
        return;
      }
      setExtracted(result.holdings);
      setReviewNote(
        result.method === "tesseract"
          ? `Read ${result.holdings.length} holding${result.holdings.length > 1 ? "s" : ""} with free OCR — check the numbers against your app before analyzing.`
          : `Read ${result.holdings.length} holding${result.holdings.length > 1 ? "s" : ""} from your screenshot. Fix anything that looks off.`
      );
      try {
        localStorage.setItem(SAVED_POSITIONS_KEY, JSON.stringify(result.holdings));
      } catch {
        // ignore persistence failures — the in-memory rows still work
      }
      setView("review");
    } catch (err: unknown) {
      // The backend distinguishes "not an image", "over 8MB — crop to the
      // holdings list", and "isn't a readable image", and the API client turns
      // an unset NEXT_PUBLIC_API_URL into a message naming that variable.
      // Collapsing all of it into "couldn't reach the reader" sent people back
      // to retry the same oversized HEIC instead of cropping it.
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't reach the screenshot reader right now — try manual entry instead."
      );
    } finally {
      setReading(false);
      // let the same file be picked again after a failure
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleManualSubmit = (positions: ManualPosition[]) => {
    const parsed = positions
      .map((p) => ({ ticker: p.ticker.trim(), qty: Number(p.qty), avg: Number(p.avg) }))
      .filter((p) => p.ticker && p.qty > 0 && p.avg > 0);
    try {
      localStorage.setItem(SAVED_POSITIONS_KEY, JSON.stringify(parsed));
    } catch {
      // ignore persistence failures
    }
    onStart(() => analyzePositions(parsed));
  };

  // Once a screenshot has been read, offer the way back into those rows so a
  // stray Back tap doesn't cost another upload + OCR round trip.
  const hasSavedRows = readSavedPositions().length > 0;

  if (view === "manual") {
    // These rows were written to localStorage on every submit and never read
    // back, so a failed analysis or a stray Back tap meant retyping the whole
    // portfolio. Restore them.
    const saved = readSavedPositions();
    return (
      <ManualEntry
        // While editing, Back returns to the results the user came from
        // rather than dumping them on the empty state.
        onBack={onExitEdit ?? (() => setView("choose"))}
        onSubmit={handleManualSubmit}
        initialPositions={saved.length > 0 ? saved : undefined}
      />
    );
  }

  if (view === "review") {
    return (
      <ManualEntry
        onBack={() => setView("choose")}
        onSubmit={handleManualSubmit}
        initialPositions={extracted}
        reviewBanner={reviewNote}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[55] overflow-y-auto bg-base">
      <div className="mx-auto flex min-h-full max-w-app flex-col justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <p className="text-center text-[20px] font-extrabold text-gold">Sift</p>

          <h1 className="mt-6 text-center text-[28px] font-bold leading-[1.2] tracking-[-0.5px] text-primary">
            What is your portfolio
            <br />
            actually doing?
          </h1>

          <p className="mx-auto mt-3 max-w-[320px] text-center text-[15px] leading-[1.6] text-secondary">
            Upload a screenshot or just type it in. We&apos;ll tell you the
            truth — not what you want to hear.
          </p>

          {/* hidden file input — screenshot goes to OCR, then the review form */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-dim px-3 py-2.5">
              <AlertCircle size={16} className="shrink-0 text-red" />
              <p className="text-[12px] leading-snug text-red">{error}</p>
            </div>
          )}

          {/* the two ways in */}
          <div className="mt-7 space-y-2.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => fileRef.current?.click()}
              disabled={reading}
              className="group flex w-full items-center gap-3 rounded-2xl border border-subtle bg-gradient-to-b from-white/[0.04] to-transparent bg-surface px-4 py-3.5 text-left transition-colors hover:border-strong hover:bg-elevated disabled:opacity-70"
            >
              {reading ? (
                <Loader2 size={20} className="shrink-0 animate-spin text-gold" />
              ) : (
                <Upload size={20} strokeWidth={2.2} className="shrink-0 text-gold" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-primary">
                  {reading ? "Reading your screenshot…" : "Upload a screenshot"}
                </span>
                <span className="block text-[12px] text-muted">
                  {reading ? "Pulling out tickers, qty and avg price" : "You confirm what we read · Groww · Zerodha · Kuvera"}
                </span>
              </span>
              {!reading && (
                <ChevronRight
                  size={18}
                  className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
                />
              )}
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setView("manual")}
              className="group flex w-full items-center gap-3 rounded-2xl border border-subtle bg-gradient-to-b from-white/[0.04] to-transparent bg-surface px-4 py-3.5 text-left transition-colors hover:border-strong hover:bg-elevated"
            >
              <PenLine size={20} strokeWidth={2.2} className="shrink-0 text-gold" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-primary">
                  {hasSavedRows ? "Continue where you left off" : "Enter positions manually"}
                </span>
                <span className="block text-[12px] text-muted">
                  {hasSavedRows
                    ? "Your rows are still here — pick up and analyze"
                    : "Type in what you hold — no account needed"}
                </span>
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

          {/* A "12,431 portfolios analyzed" counter used to animate here, styled
              as a live ticker. Both that number and the "avg 3 problems" figure
              were invented. Nothing replaces it until the count is real. */}

          {/* locked teasers — a sliver of the prize behind each lock */}
          <div className="mt-7 space-y-2.5">
            {/* Previews of what an analysis surfaces. These used to be
                buttons wired to fileRef.click(), so tapping "Unlock" — which
                reads as "explain this to me" — threw up the OS camera/gallery
                sheet with no warning, from the app's most curiosity-driven
                control. They're now inert; the two real CTAs sit above. */}
            {teasers.map((t) => (
              <div
                key={t.label}
                className="flex h-14 w-full items-center justify-between rounded-2xl border border-subtle bg-surface px-4 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-secondary">{t.label}</span>
                  <span className="block select-none truncate text-[11px] text-muted blur-[3px]">
                    {t.stat}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-muted">
                  <Lock size={13} />
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
