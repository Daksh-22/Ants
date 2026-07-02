"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, PenLine } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Reveal } from "@/components/ui/Reveal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { tribe, discoverTribes } from "@/lib/data/mock";
import { formatPercent } from "@/lib/utils/formatPercent";
import { SwarmRadar } from "@/components/tribes/SwarmRadar";
import { MirrorModal } from "@/components/tribes/MirrorModal";

export default function TribesPage() {
  const top = tribe.leaderboard[0];
  const convictionPct = (tribe.conviction / 10) * 100;
  
  // State to handle the Queen Ant execution modal
  const [selectedMember, setSelectedMember] = useState<any | null>(null);

  return (
    <div className="px-5 pt-7">
      <Reveal>
        <h1 className="text-[22px] font-bold text-primary">Find your tribe</h1>
      </Reveal>

      <Reveal index={1} className="mt-4">
        <div className="flex items-center gap-2.5 rounded-xl bg-purple-dim px-3.5 py-2.5">
          <Sparkles size={16} className="shrink-0 text-purple" />
          <p className="text-[13px] font-medium text-primary">
            Community launches soon. <span className="font-semibold text-purple">You&apos;re early.</span>
          </p>
        </div>
      </Reveal>

      <Reveal index={2} className="mt-5">
        <Card className="border border-gold">
          <p className="text-[20px] font-bold leading-tight text-gold">{tribe.name}</p>
          <p className="mt-1 text-[13px] text-secondary tabular">
            {tribe.members.toLocaleString("en-IN")} ants · {formatPercent(tribe.avgReturn)} avg this year
          </p>

          <div className="mt-5">
            <div className="flex items-baseline justify-between">
              <SectionLabel>Conviction</SectionLabel>
              <span className="text-[15px] font-medium text-secondary">
                <AnimatedNumber
                  value={tribe.conviction}
                  format={(n) => n.toFixed(1)}
                  className="text-[26px] font-extrabold text-gold"
                />
                <span className="ml-0.5 text-muted">/10</span>
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-pressed">
              <motion.div
                className="h-full rounded-full bg-gold"
                initial={{ width: 0 }}
                animate={{ width: `${convictionPct}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 22, delay: 0.3 }}
              />
            </div>
          </div>

          <p className="mt-5 text-[14px] leading-snug text-primary">
            <span className="font-semibold text-gold">{top.handle}</span> is up{" "}
            <span className="font-semibold text-teal">{Math.round(top.ytd)}%</span> this year in this tribe
          </p>

          <p className="mt-3 text-[12px] text-muted">
            You&apos;ve been here {tribe.membershipMonths} months
          </p>
        </Card>
      </Reveal>

      <Reveal index={3}>
        <SwarmRadar />
      </Reveal>

      <section className="mt-7">
        <Reveal index={5}>
          <SectionLabel>This tribe&apos;s sharpest</SectionLabel>
        </Reveal>

        <div className="mt-2">
          {tribe.leaderboard.map((member, i) => (
            <Reveal key={member.handle} index={6 + i}>
              <motion.div
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedMember(member)}
                transition={{ type: "spring", stiffness: 600, damping: 30 }}
                className="flex items-start gap-3 py-3.5 cursor-pointer hover:bg-surface/50 rounded-xl px-2 -mx-2 transition-colors"
              >
                <span className="mt-1.5 w-4 shrink-0 text-center text-[14px] font-bold text-muted tabular">
                  {i + 1}
                </span>
                <Avatar initials={member.initials} color="purple" size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] font-semibold text-gold">{member.handle}</span>
                    <span className="shrink-0 text-[16px] font-bold text-teal tabular">
                      {formatPercent(member.ytd)} YTD
                    </span>
                  </div>
                  {member.note && (
                    <p className="mt-1 text-[13px] leading-snug text-secondary">{member.note}</p>
                  )}
                </div>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <Reveal index={9}>
          <SectionLabel>Other tribes</SectionLabel>
        </Reveal>

        <Reveal index={10} className="mt-3">
          <div className="-mx-5">
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">
              {discoverTribes.map((dt) => (
                <Card key={dt.name} pressable className="w-[160px] shrink-0 p-4">
                  <p className="text-[15px] font-bold leading-tight text-gold">{dt.name}</p>
                  <p className="mt-1 text-[12px] text-muted">{dt.membersLabel}</p>
                  <p className="mt-4 text-[18px] font-bold text-teal tabular">
                    {formatPercent(dt.avgReturn)}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Render the Mirror Execution Modal */}
      <MirrorModal 
        isOpen={!!selectedMember} 
        onClose={() => setSelectedMember(null)} 
        member={selectedMember} 
      />
    </div>
  );
}