"use client";

import { AlertCircle } from "lucide-react";

/**
 * "These aren't your numbers" banner.
 *
 * Every screen that can fall back to DEFAULT_ANALYSIS needs one. /home said so
 * (Results.tsx); /insights, /portfolio and /profile did not, so a sample
 * portfolio's ₹104,019 rendered on three screens with nothing marking it as
 * someone else's — including under headings like "You vs Nifty 50".
 *
 * Render this whenever `analysis.source === "demo"`.
 */
export function DemoBanner({ className }: { className?: string }) {
  return (
    <div
      className={
        "flex items-start gap-2 rounded-xl border border-gold/25 bg-gold-dim px-3 py-2.5 " +
        (className ?? "")
      }
    >
      <AlertCircle size={15} className="mt-0.5 shrink-0 text-gold" />
      <p className="text-[12px] leading-snug text-gold">
        <span className="font-bold">Sample portfolio.</span> These aren&apos;t
        your numbers — add your holdings to see your own.
      </p>
    </div>
  );
}
