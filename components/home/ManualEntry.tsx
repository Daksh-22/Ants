"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { formatINR } from "@/lib/utils/formatINR";
import { cn } from "@/lib/utils/cn";

export interface ManualPosition {
  id: string;
  ticker: string;
  qty: string;
  avg: string;
}

interface ManualEntryProps {
  onBack: () => void;
  onSubmit: (positions: ManualPosition[]) => void;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `row_${Date.now()}_${Math.random()}`;

const emptyRow = (): ManualPosition => ({ id: newId(), ticker: "", qty: "", avg: "" });

const inputCls =
  "w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-[15px] text-primary outline-none transition-colors placeholder:text-muted focus:border-strong focus:ring-1 focus:ring-gold";

/**
 * Manual position entry — the no-account, full-control path. Add rows of
 * ticker / quantity / average buy price. Captured to localStorage, then the
 * (mocked) analysis runs. Real OCR/AA parsing replaces the mock later.
 */
export function ManualEntry({ onBack, onSubmit }: ManualEntryProps) {
  const [rows, setRows] = useState<ManualPosition[]>([emptyRow(), emptyRow()]);
  const [triedSubmit, setTriedSubmit] = useState(false);

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
  const canSubmit = complete.length > 0;

  const total = complete.reduce((sum, r) => sum + Number(r.qty) * Number(r.avg), 0);
  const liveTotal = useCountUp(total, 500);

  const handleSubmit = () => {
    if (!canSubmit) {
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
          <h1 className="text-[22px] font-bold text-primary">Add your positions</h1>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-secondary">
          Add what you hold — even your 3–4 biggest is enough to get a real read.
        </p>

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
              return (
                <motion.div
                  key={row.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="grid grid-cols-[1fr_56px_88px_24px] items-center gap-2"
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
                    onChange={(e) => update(row.id, "qty", e.target.value.replace(/[^0-9]/g, ""))}
                    inputMode="numeric"
                    placeholder="0"
                    aria-label="Quantity"
                    className={cn(inputCls, "text-right tabular", flagged && "border-red focus:ring-red")}
                  />
                  <input
                    value={row.avg}
                    onChange={(e) => update(row.id, "avg", e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    placeholder="0"
                    aria-label="Average buy price"
                    className={cn(inputCls, "text-right tabular", flagged && "border-red focus:ring-red")}
                  />
                  <button
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length <= 1}
                    aria-label="Remove row"
                    className="flex justify-center text-muted transition-opacity disabled:opacity-30"
                  >
                    <X size={16} strokeWidth={2.4} />
                  </button>
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
