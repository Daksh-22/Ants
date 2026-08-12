"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowLeft, Check, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { formatINR } from "@/lib/utils/formatINR";
import { cn } from "@/lib/utils/cn";
import { resolveTickers, type ResolvedTicker } from "@/lib/api/portfolio";

export interface ManualPosition {
  id: string;
  ticker: string;
  qty: string;
  avg: string;
}

interface ManualEntryProps {
  onBack: () => void;
  onSubmit: (positions: ManualPosition[]) => void;
  /** pre-fill rows — used when arriving from OCR review instead of a blank form */
  initialPositions?: { ticker: string; qty: number; avg: number }[];
  /** shown above the form when rows came from OCR — e.g. "double-check these numbers" */
  reviewBanner?: string;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `row_${Date.now()}_${Math.random()}`;

const emptyRow = (): ManualPosition => ({ id: newId(), ticker: "", qty: "", avg: "" });

/**
 * Digits with at most one decimal point.
 *
 * Quantity used to strip "." entirely, which made every mutual-fund unit,
 * fractional ETF and SIP holding un-enterable — "12.345" became "12345".
 * Price allowed unlimited dots, so "12.3.4" passed the filter, became NaN, and
 * the row silently failed the completeness check while the error copy blamed a
 * missing quantity.
 */
const sanitizeDecimal = (raw: string): string => {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [head, ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${head}.${rest.join("")}` : head;
};

const inputCls =
  "w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-[15px] text-primary outline-none transition-colors placeholder:text-muted focus:border-strong focus:ring-1 focus:ring-gold";

/**
 * Manual position entry — the no-account, full-control path. Add rows of
 * ticker / quantity / average buy price. Also doubles as the OCR review
 * screen: when `initialPositions` is passed (from a screenshot extraction),
 * the form pre-fills with those guesses instead of two blank rows, so the
 * user corrects mistakes rather than blindly trusting free OCR.
 */
export function ManualEntry({ onBack, onSubmit, initialPositions, reviewBanner }: ManualEntryProps) {
  const [rows, setRows] = useState<ManualPosition[]>(() =>
    initialPositions && initialPositions.length > 0
      ? initialPositions.map((p) => ({
          id: newId(),
          ticker: p.ticker,
          qty: String(p.qty),
          avg: String(p.avg),
        }))
      : [emptyRow(), emptyRow()]
  );
  const [triedSubmit, setTriedSubmit] = useState(false);

  // Live symbol confirmation. Without it a typo silently becomes a holding
  // priced at the user's own average — it reads as a real position at exactly
  // 0.0% and still skews totals, weights and the concentration flags. Showing
  // the resolved company name is also the cheapest trust signal in the form:
  // the user can see we found the same stock they meant.
  const [lookup, setLookup] = useState<Record<string, ResolvedTicker>>({});
  const [checking, setChecking] = useState<string[]>([]);
  const inflight = useRef<Set<string>>(new Set());

  const tickerKeys = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((r) => r.ticker.trim().toUpperCase())
            .filter((t) => t.length >= 2)
        )
      ),
    [rows]
  );

  useEffect(() => {
    const pending = tickerKeys.filter(
      (t) => !(t in lookup) && !inflight.current.has(t)
    );
    if (pending.length === 0) return;

    // debounce so we resolve settled input, not every keystroke
    const timer = setTimeout(() => {
      pending.forEach((t) => inflight.current.add(t));
      setChecking((c) => [...c, ...pending]);
      resolveTickers(pending)
        .then(({ results }) => {
          setLookup((prev) => {
            const next = { ...prev };
            for (const r of results) next[r.input.trim().toUpperCase()] = r;
            return next;
          });
        })
        .catch(() => {
          // backend unreachable — stay silent rather than flagging valid
          // symbols as unknown, and let submission proceed
        })
        .finally(() => {
          pending.forEach((t) => inflight.current.delete(t));
          setChecking((c) => c.filter((t) => !pending.includes(t)));
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [tickerKeys, lookup]);

  const statusFor = (raw: string) => {
    const key = raw.trim().toUpperCase();
    if (key.length < 2) return null;
    if (checking.includes(key)) return { state: "checking" as const };
    const hit = lookup[key];
    if (!hit) return null;
    return hit.found
      ? { state: "found" as const, name: hit.name, cmp: hit.cmp }
      : { state: "missing" as const };
  };

  const update = (id: string, field: keyof ManualPosition, value: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (id: string) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));

  const isRowComplete = (r: ManualPosition) =>
    r.ticker.trim().length > 0 && Number(r.qty) > 0 && Number(r.avg) > 0;
  const isRowTouched = (r: ManualPosition) =>
    r.ticker.trim().length > 0 || r.qty.length > 0 || r.avg.length > 0;

  const complete = rows.filter(isRowComplete);
  const incomplete = rows.filter((r) => isRowTouched(r) && !isRowComplete(r));
  // A started-but-unfinished row must block submission, not be discarded.
  const canSubmit = complete.length > 0 && incomplete.length === 0;

  const total = complete.reduce((sum, r) => sum + Number(r.qty) * Number(r.avg), 0);
  const liveTotal = useCountUp(total, 500);

  const handleSubmit = () => {
    if (!canSubmit) {
      // surfaces the red borders + the "needs a quantity and price" message
      setTriedSubmit(true);
      return;
    }
    onSubmit(complete);
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-base">
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="mx-auto flex min-h-full max-w-app flex-col px-5 pb-4 pt-6"
      >
        {/* header */}
        <div className="flex items-center gap-3">
          <button onClick={onBack} aria-label="Back" className="-m-1 p-1 text-secondary">
            <ArrowLeft size={22} strokeWidth={2.2} />
          </button>
          <h1 className="text-[22px] font-bold text-primary">
            {reviewBanner ? "Confirm your positions" : "Add your positions"}
          </h1>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-secondary">
          {reviewBanner
            ? "Fix anything that's wrong, then analyze."
            : "Add what you hold — even your 3–4 biggest is enough to get a real read."}
        </p>

        {reviewBanner && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-amber-dim px-3.5 py-2.5">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber" />
            <p className="text-[12px] leading-snug text-amber">{reviewBanner}</p>
          </div>
        )}

        {/* column labels */}
        <div className="mt-6 grid grid-cols-[1fr_56px_88px_24px] gap-2 px-1 text-label uppercase text-muted">
          <span>Stock</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Avg ₹</span>
          <span />
        </div>

        {/* rows */}
        <div className="mt-2 flex-1 space-y-2">
          <AnimatePresence initial={false}>
            {rows.map((row) => {
              const flagged = triedSubmit && isRowTouched(row) && !isRowComplete(row);
              const status = statusFor(row.ticker);
              return (
                <motion.div
                  key={row.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="grid grid-cols-[1fr_56px_88px_24px] items-center gap-x-2 gap-y-0"
                >
                  <input
                    value={row.ticker}
                    onChange={(e) => update(row.id, "ticker", e.target.value.toUpperCase())}
                    placeholder="TCS"
                    aria-label="Stock ticker"
                    className={cn(inputCls, flagged && "border-red focus:ring-red")}
                  />
                  <input
                    value={row.qty}
                    onChange={(e) => update(row.id, "qty", sanitizeDecimal(e.target.value))}
                    inputMode="decimal"
                    placeholder="0"
                    aria-label="Quantity"
                    className={cn(inputCls, "text-right tabular", flagged && "border-red focus:ring-red")}
                  />
                  <input
                    value={row.avg}
                    onChange={(e) => update(row.id, "avg", sanitizeDecimal(e.target.value))}
                    inputMode="decimal"
                    placeholder="0"
                    aria-label="Average buy price"
                    className={cn(inputCls, "text-right tabular", flagged && "border-red focus:ring-red")}
                  />
                  <button
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length <= 1}
                    aria-label="Remove row"
                    className="-m-3 flex h-11 w-11 items-center justify-center p-3 text-muted transition-opacity disabled:opacity-30"
                  >
                    <X size={16} strokeWidth={2.4} />
                  </button>

                  {/* resolved symbol — confirms we found the same stock the
                      user meant, and catches typos before they become a
                      holding priced at their own average */}
                  {status && (
                    <div className="col-span-4 -mt-0.5 flex items-center gap-1.5 px-1 pb-1">
                      {status.state === "checking" && (
                        <>
                          <Loader2 size={11} className="animate-spin text-muted" />
                          <span className="text-[11px] text-muted">Checking…</span>
                        </>
                      )}
                      {status.state === "found" && (
                        <>
                          <Check size={11} strokeWidth={3} className="text-teal" />
                          <span className="truncate text-[11px] text-secondary">
                            {status.name}
                            {status.cmp !== null && (
                              <span className="text-muted"> · {formatINR(status.cmp)}</span>
                            )}
                          </span>
                        </>
                      )}
                      {status.state === "missing" && (
                        <>
                          <AlertCircle size={11} className="text-amber" />
                          <span className="text-[11px] text-amber">
                            Couldn&apos;t find that symbol — check the spelling
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {triedSubmit && incomplete.length > 0 && (
          <p className="mt-2 text-[12px] font-medium text-red">
            {incomplete.length} row{incomplete.length > 1 ? "s" : ""} need a quantity and price
          </p>
        )}

        {/* add row */}
        <button
          onClick={addRow}
          className="mt-3 inline-flex items-center gap-1.5 self-start text-[14px] font-semibold text-gold"
        >
          <Plus size={16} strokeWidth={2.6} />
          Add another
        </button>

        {/* sticky footer — running total + submit, safe above the iOS keyboard/home bar */}
        <div className="sticky bottom-0 -mx-5 mt-6 bg-gradient-to-t from-base via-base/95 to-transparent px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
          {total > 0 && (
            <p className="mb-2 text-center text-[13px] text-secondary">
              Portfolio so far:{" "}
              <span className="font-bold tabular text-primary">{formatINR(liveTotal)}</span>
            </p>
          )}
          <Button className="w-full disabled:opacity-40" disabled={!canSubmit} onClick={handleSubmit}>
            {canSubmit
              ? `Analyze ${complete.length} position${complete.length > 1 ? "s" : ""}`
              : "Analyze my portfolio"}
          </Button>
          <p className="mt-3 text-center text-[11px] text-muted">
            🔒 Stays on your device. We don&apos;t store anything.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
