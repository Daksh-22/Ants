"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

export interface ManualPosition {
  ticker: string;
  qty: string;
  avg: string;
}

interface ManualEntryProps {
  onBack: () => void;
  onSubmit: (positions: ManualPosition[]) => void;
}

const emptyRow = (): ManualPosition => ({ ticker: "", qty: "", avg: "" });

const inputCls =
  "w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-[15px] text-primary outline-none transition-colors placeholder:text-muted focus:border-strong focus:ring-1 focus:ring-gold";

/**
 * Manual position entry — the no-account, full-control path. Add rows of
 * ticker / quantity / average buy price. Captured to localStorage, then the
 * (mocked) analysis runs. Real OCR/AA parsing replaces the mock later.
 */
export function ManualEntry({ onBack, onSubmit }: ManualEntryProps) {
  const [rows, setRows] = useState<ManualPosition[]>([emptyRow(), emptyRow()]);

  const update = (i: number, field: keyof ManualPosition, value: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (i: number) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));

  const valid = rows.filter((r) => r.ticker.trim().length > 0);
  const canSubmit = valid.length > 0;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-base">
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="mx-auto min-h-full max-w-app px-5 pb-10 pt-6"
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
        <div className="mt-2 space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_56px_88px_24px] items-center gap-2">
              <input
                value={row.ticker}
                onChange={(e) => update(i, "ticker", e.target.value.toUpperCase())}
                placeholder="TCS"
                aria-label="Stock ticker"
                className={inputCls}
              />
              <input
                value={row.qty}
                onChange={(e) => update(i, "qty", e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                placeholder="0"
                aria-label="Quantity"
                className={cn(inputCls, "text-right tabular")}
              />
              <input
                value={row.avg}
                onChange={(e) => update(i, "avg", e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="0"
                aria-label="Average buy price"
                className={cn(inputCls, "text-right tabular")}
              />
              <button
                onClick={() => removeRow(i)}
                disabled={rows.length <= 1}
                aria-label="Remove row"
                className="flex justify-center text-muted transition-opacity disabled:opacity-30"
              >
                <X size={16} strokeWidth={2.4} />
              </button>
            </div>
          ))}
        </div>

        {/* add row */}
        <button
          onClick={addRow}
          className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-gold"
        >
          <Plus size={16} strokeWidth={2.6} />
          Add another
        </button>

        {/* submit */}
        <Button
          className="mt-8 w-full disabled:opacity-40"
          disabled={!canSubmit}
          onClick={() => onSubmit(valid)}
        >
          {canSubmit
            ? `Analyze ${valid.length} position${valid.length > 1 ? "s" : ""}`
            : "Analyze my portfolio"}
        </Button>
        <p className="mt-3 text-center text-[11px] text-muted">
          🔒 Stays on your device. We don&apos;t store anything.
        </p>
      </motion.div>
    </div>
  );
}
