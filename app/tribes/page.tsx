"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Reveal } from "@/components/ui/Reveal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { tribe, discoverTribes, type TribeMember } from "@/lib/data/mock";
import { formatPercent } from "@/lib/utils/formatPercent";
import { SwarmRadar } from "@/components/tribes/SwarmRadar";
import { MirrorModal } from "@/components/tribes/MirrorModal";

export default function TribesPage() {
  const top = tribe.leaderboard[0];
  const convictionPct = (tribe.conviction / 10) * 100;

  const [selectedMember, setSelectedMember] = useState<TribeMember | null>(null);
  const [waitlistTribe, setWaitlistTribe] = useState<(typeof discoverTribes)[number] | null>(null);
  const [joined, setJoined] = useState(false);

  return (
    <div className="px-5 pt-7">
      <Reveal>
        <h1 className="text-[22px] font-bold text-primary">Find your tribe</h1>
      </Reveal>

      <Reveal index={1} className="mt-4">
        <div className="flex items-center gap-2.5 rounded-xl bg-purple-dim px-3.5 py-2.5">
          <Sparkles size={16} className="shrink-0 text-purple" />
          <p className="min-w-0 flex-1 text-[13px] font-medium text-primary">
            You&apos;re <span className="font-bold text-purple">#214</span> on the waitlist — invite 3
            friends to unlock tribe chat early.
          </p>
        </div>
      </Reveal>

      <Reveal index={2} className="mt-5">
        <Card className="relative overflow-hidden border border-gold/25 bg-gold-dim">
          <div className="pointer-events-none absolute -left-6 -top-10 h-40 w-40 rounded-full bg-gold/20 blur-3xl" />
          <p className="relative text-[20px] font-bold leading-tight text-gold">{tribe.name}</p>
          <p className="relative mt-1 text-[13px] text-secondary tabular">
            {tribe.members.toLocaleString("en-IN")} ants · {formatPercent(tribe.avgReturn)} avg this year
          </p>

          <div className="relative mt-5">
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
                className="h-full rounded-full fill-gold-gradient"
                initial={{ width: 0 }}
                animate={{ width: `${convictionPct}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 22, delay: 0.3 }}
              />
            </div>
          </div>

          <p className="relative mt-5 text-[14px] leading-snug text-primary">
            <span className="font-semibold text-gold">{top.handle}</span> is up{" "}
            <span className="font-semibold text-teal">{Math.round(top.ytd)}%</span> this year in this tribe
          </p>

          <p className="relative mt-3 text-[12px] text-muted">
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
                className="-mx-2 flex cursor-pointer items-start gap-3 rounded-xl px-2 py-3.5 transition-colors hover:bg-surface/50"
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
                <Card
                  key={dt.name}
                  pressable
                  onClick={() => setWaitlistTribe(dt)}
                  className="w-[160px] shrink-0 p-4"
                >
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

      {/* Other-tribe peek — a real destination, not a dead card */}
      <AnimatePresence>
        {waitlistTribe && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setWaitlistTribe(null);
                setJoined(false);
              }}
              className="fixed inset-0 z-[60] bg-black/60"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-app rounded-t-3xl bg-elevated px-6 pb-8 pt-3"
            >
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-strong" />
              <div className="flex items-start justify-between">
                <h3 className="text-[18px] font-bold text-primary">{waitlistTribe.name}</h3>
                <button
                  onClick={() => {
                    setWaitlistTribe(null);
                    setJoined(false);
                  }}
                  className="-m-1 p-1 text-muted"
                >
                  <X size={20} strokeWidth={2.4} />
                </button>
              </div>
              <p className="mt-1 text-[13px] text-muted">
                {waitlistTribe.membersLabel} · {formatPercent(waitlistTribe.avgReturn)} avg this year
              </p>
              <p className="mt-4 text-[14px] leading-relaxed text-secondary">
                Tribe chat isn&apos;t open yet — join the waitlist and you&apos;ll be pinged the moment{" "}
                {waitlistTribe.name} goes live.
              </p>
              {joined ? (
                <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-teal-dim py-3.5 text-[14px] font-bold text-teal">
                  You&apos;re on the list
                </div>
              ) : (
                <button
                  onClick={() => setJoined(true)}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl fill-gold-gradient py-3.5 text-[14px] font-bold text-ink shadow-cta"
                >
                  <UserPlus size={16} strokeWidth={2.6} />
                  Join waitlist
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
