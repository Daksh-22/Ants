"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { HoldingRow } from "@/components/ui/HoldingRow";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useAppState } from "@/components/app/AppState";
import { DEFAULT_ANALYSIS } from "@/lib/analysis/default";
import { sips, type ComputedHolding } from "@/lib/data/mock";
import { formatINR } from "@/lib/utils/formatINR";
import { formatPercent } from "@/lib/utils/formatPercent";
import { cn } from "@/lib/utils/cn";

/**
 * The Portfolio tab renders the SAME live analysis as home — manual /
 * screenshot / broker, falling back to the built-in demo. Holdings, P&L and
 * the audit all come off the analysis object; nothing here is invented.
 */
export default function PortfolioPage() {
  const { analysis: stored, doneFixes } = useAppState();
  const analysis = stored ?? DEFAULT_ANALYSIS;

  // adapt analysis holdings (already winners-first) to the HoldingRow shape.
  // the most saturated bar belongs to the biggest mover — win or loss —
  // everything else fades relative to it.
  const { rows, maxAbsReturn } = useMemo(() => {
    const max = analysis.holdings.reduce((m, h) => Math.max(m, Math.abs(h.returnPct)), 0);
    const adapted: ComputedHolding[] = analysis.holdings.map((h) => ({
      name: h.name,
      sector: h.sector,
      shares: h.qty,
      avg: h.avg,
      cmp: h.cmp,
      unit: h.name.includes("ETF") ? "units" : "shares",
      value: h.value,
      investedValue: h.invested,
      returnPct: h.returnPct,
    }));
    return { rows: adapted, maxAbsReturn: max };
  }, [analysis]);

  const flagCount = analysis.flags.length;

  return (
    <div className="px-5 pt-7">
      {/* ───── Page title ───── */}
      <Reveal>
        <h1 className="text-[22px] font-bold text-primary">Your portfolio</h1>
      </Reveal>

      {/* ───── P&L hero — floats on the base, no container ───── */}
      <Reveal index={1} className="pb-7 pt-5">
        <AnimatedNumber
          value={analysis.summary.totalValue}
          format={(n) => formatINR(n)}
          className="block text-display font-extrabold text-primary"
        />
        <p className="mt-2 text-[15px]">
          <AnimatedNumber
            value={analysis.summary.returnsPct}
            format={(n) => formatPercent(n)}
            className={cn("font-bold", analysis.summary.returnsPct >= 0 ? "text-teal" : "text-red")}
          />
          <span className="text-muted">{"  "}</span>
          <AnimatedNumber
            value={analysis.summary.returnsAbs}
            format={(n) => formatINR(n, { signed: true })}
            className={cn("font-bold", analysis.summary.returnsAbs >= 0 ? "text-teal" : "text-red")}
          />
          <span className="text-secondary"> total</span>
        </p>
        <p className="mt-1 text-[13px] text-muted">
          Invested <span className="tabular">{formatINR(analysis.summary.invested)}</span>
        </p>
      </Reveal>

      {/* ───── Holdings — a plain full-width list, whitespace does the dividing ───── */}
      <Reveal index={2}>
        <SectionLabel className="mb-1">Holdings</SectionLabel>
      </Reveal>
      <Reveal index={3}>
        <div>
          {rows.map((h, i) => (
            <HoldingRow
              key={analysis.holdings[i].ticker || h.name}
              holding={h}
              weight={analysis.holdings[i].weightPct / 100}
              intensity={maxAbsReturn > 0 ? Math.abs(h.returnPct) / maxAbsReturn : 0.3}
              index={i}
            />
          ))}
        </div>
      </Reveal>

      {/* ───── Honest audit — the smart-friend telling you the truth ───── */}
      {flagCount > 0 && (
        <>
          <Reveal index={4}>
            <h2 className="mb-3 mt-8 text-[18px] font-semibold text-primary">
              What&apos;s actually going on
            </h2>
          </Reveal>

          <div className="space-y-3">
            {analysis.flags.map((flag, i) => {
              const isDone = !!flag.fix && doneFixes.includes(flag.fix.id);
              const toneColor = isDone ? "teal" : flag.severity === "red" ? "red" : "amber";
              return (
                <Reveal key={flag.id} index={5 + i}>
                  <Card
                    className={cn(
                      "border-l-[3px]",
                      toneColor === "red" ? "border-red" : toneColor === "amber" ? "border-amber" : "border-teal"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          toneColor === "red" ? "bg-red" : toneColor === "amber" ? "bg-amber" : "bg-teal"
                        )}
                      />
                      <span className={cn("text-label uppercase", isDone ? "text-teal" : "text-muted")}>{flag.label}</span>
                    </div>
                    <p className="mt-2.5 text-[14px] leading-[1.55] text-secondary">{flag.body}</p>
                    {isDone ? (
                      <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-teal-dim px-2.5 py-1 text-[12px] font-semibold text-teal">
                        <Check size={12} strokeWidth={3} />
                        Sorted
                      </span>
                    ) : (
                      flag.fix && (
                        <Link
                          href="/home"
                          className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-gold"
                        >
                          Fix it on Home
                          <ArrowRight size={13} strokeWidth={2.6} />
                        </Link>
                      )
                    )}
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </>
      )}

      {/* ───── SIPs — demo portfolio only. A real analysis has no SIP data,
             and we don't show numbers we didn't measure. ───── */}
      {analysis.source === "demo" && (
        <>
          <Reveal index={5 + flagCount}>
            <SectionLabel className="mb-1 mt-8">Your SIPs</SectionLabel>
          </Reveal>
          <Reveal index={6 + flagCount}>
            <div>
              {sips.map((sip) => (
                <SipRow key={sip.name} sip={sip} />
              ))}
            </div>
          </Reveal>
        </>
      )}
    </div>
  );
}

// ───── inline SIP list item — mirrors the HoldingRow rhythm ─────
function SipRow({ sip }: { sip: (typeof sips)[number] }) {
  return (
    <div className="select-none py-3.5">
      <div className="flex items-start justify-between gap-3">
        {/* left: name (+ flag) + sub-line */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {sip.flag && (
              <span className="size-1.5 shrink-0 rounded-full bg-amber" aria-hidden />
            )}
            <span className="truncate text-[16px] font-semibold text-primary">{sip.name}</span>
            {sip.flag && (
              <Badge tone="warn" size="sm">
                Regular plan
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[12px] text-muted">
            <span className="tabular">{formatINR(sip.monthly)}</span>/mo ·{" "}
            <span className="tabular">{sip.months}</span> months
          </p>
        </div>

        {/* right: return % — teal, the win */}
        <div className="shrink-0 text-right">
          <p className="text-[14px] font-semibold text-teal tabular">
            {formatPercent(sip.returnPct)}
          </p>
        </div>
      </div>
    </div>
  );
}
