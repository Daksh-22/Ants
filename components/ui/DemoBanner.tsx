"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * "These aren't your numbers."
 *
 * The single banner for the sample-portfolio state. There used to be two: an
 * amber AlertTriangle strip with a Retry on /home, and a gold AlertCircle with
 * different copy and no action on the other three tabs — driven by two
 * different flags (`isDemo` from AppState vs `analysis.source === "demo"`)
 * that could disagree.
 *
 * It also has to be a way out, not just a notice: the old copy said "add your
 * holdings to see your own" as plain text on pages with no control that leads
 * anywhere.
 */
export function DemoBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl bg-amber-dim px-3.5 py-2.5",
        className
      )}
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber" />
      <p className="text-[12px] leading-snug text-amber">
        <span className="font-semibold">Sample portfolio.</span> These aren&apos;t your
        numbers —{" "}
        <Link href="/home" className="font-semibold underline underline-offset-2">
          add your holdings
        </Link>{" "}
        to see your own.
      </p>
    </div>
  );
}
