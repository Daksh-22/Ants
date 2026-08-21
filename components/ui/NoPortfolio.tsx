"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, PieChart } from "lucide-react";
import { Header } from "@/components/layout/Header";

interface NoPortfolioProps {
  /** what this screen would have shown, e.g. "your risk profile" */
  what: string;
}

/**
 * The strict empty state for every screen that needs a real portfolio.
 *
 * These pages used to fall back to DEFAULT_ANALYSIS — the built-in "Arjun
 * Mehta" demo book — whenever the stored analysis was missing or failed the
 * hydration shape guard. That put a stranger's ₹1,04,019 portfolio, its
 * holdings, its concentration flags and its score of 66 in front of the user as
 * if it were their own money. A demo banner was supposed to cover it, but the
 * banner and the fallback were separate checks that could and did disagree, and
 * on /home there was no banner at all.
 *
 * There is no version of this that is safe to guess at. A fintech screen either
 * shows the user's real position or asks for it.
 */
export function NoPortfolio({ what }: NoPortfolioProps) {
  return (
    <div className="min-h-dvh bg-base pb-28">
      <Header />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mx-auto flex max-w-app flex-col items-center px-6 pt-24 text-center"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-elevated">
          <PieChart size={26} strokeWidth={2.2} className="text-gold" />
        </span>

        <h1 className="mt-6 text-[22px] font-bold leading-tight tracking-[-0.4px] text-primary">
          Nothing to show yet
        </h1>
        <p className="mx-auto mt-3 max-w-[300px] text-[14px] leading-[1.6] text-secondary">
          We need your actual holdings before we can show {what}. Upload a
          screenshot of your broker app, or type your positions in — it takes
          about a minute.
        </p>

        <Link
          href="/home"
          className="mt-7 inline-flex items-center gap-2 rounded-2xl fill-gold-gradient px-6 py-3.5 text-[14px] font-bold text-ink shadow-cta"
        >
          Add your portfolio
          <ArrowRight size={16} strokeWidth={2.6} />
        </Link>

        <p className="mt-5 text-[11px] text-muted">
          🔒 Stays on your device. We don&apos;t store anything.
        </p>
      </motion.div>
    </div>
  );
}
