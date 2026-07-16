"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { executeProtectedTrade } from "@/lib/api/portfolio";
import { useAppState } from "@/components/app/AppState";
import type { TribeMember } from "@/lib/data/mock";
import { formatINR } from "@/lib/utils/formatINR";
import { formatPercent } from "@/lib/utils/formatPercent";

interface MirrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: TribeMember | null;
}

const AMOUNT_OPTIONS = [1000, 5000, 10000];
const MIRROR_XP = 40;

export function MirrorModal({ isOpen, onClose, member }: MirrorModalProps) {
  const { earnXp } = useAppState();
  const [amount, setAmount] = useState(5000);
  const [executing, setExecuting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mocking the specific allocation for the Queen Ant based on solid VCP setups
  const basket = [
    { ticker: "COALINDIA", weight: 40, thesis: "Volume breakout" },
    { ticker: "CIEINDIA", weight: 35, thesis: "VCP contraction" },
    { ticker: "ANURAS", weight: 25, thesis: "Base building" },
  ];

  const handleMirror = async () => {
    setExecuting(true);
    setError(null);
    try {
      await executeProtectedTrade("Queen Ant Basket");
      setSuccess(true);
      earnXp(MIRROR_XP, "Basket mirrored");
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2200);
    } catch {
      setError("Execution failed — check that the backend is running and try again.");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && member && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={success ? undefined : onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="card-sheen-elevated relative w-full max-w-app rounded-t-3xl px-6 pb-8 pt-4 sm:rounded-3xl"
          >
            <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-strong" />

            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar initials={member.initials} color="gold" size={42} />
                <div>
                  <h3 className="text-[18px] font-bold text-primary">{member.handle}</h3>
                  <p className="text-[14px] font-semibold text-teal">{formatPercent(member.ytd)} YTD</p>
                </div>
              </div>
              {!success && (
                <button onClick={onClose} className="rounded-full bg-surface p-1.5 text-muted hover:text-primary">
                  <X size={20} />
                </button>
              )}
            </div>

            <p className="mt-4 border-l-2 border-gold pl-3 text-[14px] leading-relaxed text-secondary">
              &ldquo;{member.note || "Focusing on tight consolidations and strong cash flows."}&rdquo;
            </p>

            {!success && (
              <>
                <div className="mt-6">
                  <p className="mb-3 text-label uppercase text-muted">Live Allocation</p>
                  <div className="space-y-3">
                    {basket.map((stock) => (
                      <div key={stock.ticker} className="flex items-center justify-between rounded-xl bg-surface p-3">
                        <div>
                          <p className="text-[15px] font-bold text-primary">{stock.ticker}</p>
                          <p className="text-[12px] text-muted">{stock.thesis}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[16px] font-extrabold text-gold">{stock.weight}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  <p className="mb-2 text-label uppercase text-muted">How much?</p>
                  <div className="flex gap-2">
                    {AMOUNT_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setAmount(opt)}
                        className={
                          amount === opt
                            ? "flex-1 rounded-xl fill-gold-gradient py-2.5 text-[13px] font-bold text-ink shadow-cta"
                            : "flex-1 rounded-xl bg-surface py-2.5 text-[13px] font-semibold text-secondary"
                        }
                      >
                        {formatINR(opt)}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="mt-3 text-[12px] text-red">{error}</p>}

                <div className="mt-6">
                  <Button
                    onClick={handleMirror}
                    loading={executing}
                    className="flex w-full items-center justify-center gap-2 py-4"
                  >
                    <Copy size={18} strokeWidth={2.5} />
                    Mirror {formatINR(amount)} · 8% Trailing Stop-Loss
                  </Button>
                </div>
              </>
            )}

            {success && <SuccessCelebration />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function SuccessCelebration() {
  const sparks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    return { x: Math.cos(angle) * 100, y: Math.sin(angle) * 100, delay: (i % 3) * 0.05 };
  });
  return (
    <div className="relative mt-8 flex flex-col items-center py-6">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {sparks.map((s, i) => (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: s.x, y: s.y, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.9, delay: s.delay, ease: "easeOut" }}
            className="absolute h-1.5 w-1.5 rounded-full bg-gold"
          />
        ))}
      </div>
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 16 }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-dim"
      >
        <Check size={30} strokeWidth={3} className="text-teal" />
      </motion.span>
      <p className="relative mt-4 text-[16px] font-bold text-primary">Basket Mirrored &amp; Protected</p>
      <p className="relative mt-1 text-[13px] font-semibold text-gold">+{MIRROR_XP} XP</p>
    </div>
  );
}
