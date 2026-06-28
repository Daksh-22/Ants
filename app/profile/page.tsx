"use client";

import { motion } from "framer-motion";
import { Flame, Users, Repeat, ShieldCheck, Bell, ChevronRight, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { user, portfolio, rank, sips, tribe } from "@/lib/data/mock";
import { formatINR } from "@/lib/utils/formatINR";
import { formatPercent } from "@/lib/utils/formatPercent";

// longest running SIP = the investing streak (Snapchat-style momentum)
const streakMonths = Math.max(...sips.map((s) => s.months));

const stats = [
  { label: "Net worth", value: formatINR(portfolio.totalValue) },
  { label: "Returns", value: formatPercent(portfolio.returnsPct), tone: "teal" as const },
  { label: "Wealth rank", value: `Top ${rank.wealthPercentile}%`, tone: "gold" as const },
];

const rows: { icon: LucideIcon; label: string; value: string }[] = [
  { icon: Users, label: "Your tribes", value: "1 joined" },
  { icon: Repeat, label: "SIPs", value: `${sips.length} active` },
  { icon: ShieldCheck, label: "Risk profile", value: user.riskProfile },
  { icon: Bell, label: "Notifications", value: "On" },
];

export default function ProfilePage() {
  return (
    <div className="px-5 pt-7">
      {/* identity */}
      <Reveal>
        <div className="flex items-center gap-4">
          <Avatar initials={user.initials} color="gold" size={60} />
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold leading-tight text-primary">{user.name}</h1>
            <p className="text-[13px] font-semibold text-gold">{user.handle}</p>
            <p className="mt-0.5 text-[12px] text-muted">
              {user.age} · {user.city} · {user.broker}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <Badge tone="gold">Aggressive investor</Badge>
        </div>
      </Reveal>

      {/* streak hero — the dominant number */}
      <Reveal index={1} className="mt-6">
        <Card className="border-l-2 border-gold bg-gold-dim">
          <SectionLabel>Investing streak</SectionLabel>
          <div className="mt-1.5 flex items-baseline gap-2">
            <Flame className="self-center text-gold" size={30} strokeWidth={2.4} />
            <AnimatedNumber
              value={streakMonths}
              format={(n) => `${Math.round(n)}`}
              className="text-display font-extrabold text-primary"
            />
            <span className="text-[16px] font-semibold text-secondary">months straight</span>
          </div>
          <p className="mt-2 text-body text-secondary">
            Your money&apos;s been working while you sleep. Don&apos;t break it now.
          </p>
        </Card>
      </Reveal>

      {/* quick stats */}
      <Reveal index={2} className="mt-4">
        <div className="grid grid-cols-3 gap-2.5">
          {stats.map((s) => (
            <Card key={s.label} className="p-3.5">
              <SectionLabel className="text-[10px]">{s.label}</SectionLabel>
              <p
                className={`mt-1 text-[15px] font-bold tabular ${
                  s.tone === "teal" ? "text-teal" : s.tone === "gold" ? "text-gold" : "text-primary"
                }`}
              >
                {s.value}
              </p>
            </Card>
          ))}
        </div>
      </Reveal>

      {/* settings-style rows */}
      <Reveal index={3} className="mt-6">
        <SectionLabel className="mb-2">Account</SectionLabel>
        <div className="space-y-2">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <motion.button
                key={row.label}
                type="button"
                whileTap={{ scale: 0.98 }}
                className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left"
              >
                <Icon size={18} strokeWidth={2.2} className="text-gold" />
                <span className="text-[15px] font-medium text-primary">{row.label}</span>
                <span className="ml-auto text-[13px] text-secondary">{row.value}</span>
                <ChevronRight size={16} className="text-muted" />
              </motion.button>
            );
          })}
        </div>
      </Reveal>

      <Reveal index={4} className="mt-6">
        <p className="text-center text-[12px] text-muted">
          Member of {tribe.name} · {tribe.membershipMonths} months in
        </p>
      </Reveal>
    </div>
  );
}
