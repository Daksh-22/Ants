"use client";

import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { HoldingRow } from "@/components/ui/HoldingRow";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { portfolio, holdings, holdingsTotalValue, sips } from "@/lib/data/mock";
import { formatINR } from "@/lib/utils/formatINR";
import { formatPercent } from "@/lib/utils/formatPercent";

// the most saturated teal bar belongs to the biggest winner — everything
// else is scaled relative to it, so HDFC (+2.4%) and Reliance (+1.8%) fade out.
const maxReturn = Math.max(...holdings.map((h) => h.returnPct));

export default function PortfolioPage() {
  return (
    <div className="px-5 pt-7">
      {/* ───── Page title ───── */}
      <Reveal>
        <h1 className="text-[22px] font-bold text-primary">Your portfolio</h1>
      </Reveal>

      {/* ───── P&L hero — floats on the base, no container ───── */}
      <Reveal index={1} className="pb-7 pt-5">
        <AnimatedNumber
          value={portfolio.totalValue}
          format={(n) => formatINR(n)}
          className="block text-display font-extrabold text-primary"
        />
        <p className="mt-2 text-[15px]">
          <AnimatedNumber
            value={portfolio.returnsPct}
            format={(n) => formatPercent(n)}
            className="font-bold text-teal"
          />
          <span className="text-muted">{"  "}</span>
          <AnimatedNumber
            value={portfolio.returnsAbs}
            format={(n) => formatINR(n, { signed: true })}
            className="font-bold text-teal"
          />
          <span className="text-secondary"> total</span>
        </p>
        <p className="mt-1 text-[13px] text-muted">
          Invested <span className="tabular">{formatINR(portfolio.invested)}</span>
        </p>
      </Reveal>

      {/* ───── Holdings — a plain full-width list, whitespace does the dividing ───── */}
      <Reveal index={2}>
        <SectionLabel className="mb-1">Holdings</SectionLabel>
      </Reveal>
      <Reveal index={3}>
        <div>
          {holdings.map((h) => (
            <HoldingRow
              key={h.name}
              holding={h}
              weight={h.value / holdingsTotalValue}
              intensity={h.returnPct / maxReturn}
            />
          ))}
        </div>
      </Reveal>

      {/* ───── Honest audit — the smart-friend telling you the truth ───── */}
      <Reveal index={4}>
        <h2 className="mb-3 mt-8 text-[18px] font-semibold text-primary">
          What&apos;s actually going on
        </h2>
      </Reveal>

      <div className="space-y-3">
        <Reveal index={5}>
          <Card className="border-l-[3px] border-red">
            <p className="text-[15px] font-semibold text-primary">
              HDFC + Reliance = 24% of your money
            </p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-secondary">
              You say AI infra. Your money says boomer index. Either believe your own thesis
              or stop saying it.
            </p>
          </Card>
        </Reveal>

        <Reveal index={6}>
          <Card className="border-l-[3px] border-amber">
            <p className="text-[15px] font-semibold text-primary">
              PGIM is on a regular plan
            </p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-secondary">
              You&apos;re paying ₹387 a year to a middleman for no reason. This takes 4 minutes
              to fix.
            </p>
            <Button variant="link" className="mt-3">
              Switch to Direct
              <ArrowRight size={14} strokeWidth={2.6} />
            </Button>
          </Card>
        </Reveal>

        <Reveal index={7}>
          <Card className="border-l-[3px] border-amber">
            <p className="text-[15px] font-semibold text-primary">
              3 funds, 1.4 funds worth of stocks
            </p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-secondary">
              Your Mirae Large Cap and Quant Small Cap share 31% of the same companies.
              Overlap isn&apos;t diversification.
            </p>
          </Card>
        </Reveal>
      </div>

      {/* ───── SIPs — same plain full-width list idiom as holdings ───── */}
      <Reveal index={8}>
        <SectionLabel className="mb-1 mt-8">Your SIPs</SectionLabel>
      </Reveal>
      <Reveal index={9}>
        <div>
          {sips.map((sip) => (
            <SipRow key={sip.name} sip={sip} />
          ))}
        </div>
      </Reveal>
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
