"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { executeProtectedTrade } from "@/lib/api/portfolio";
import { cn } from "@/lib/utils/cn";
import { formatPercent } from "@/lib/utils/formatPercent";

interface MirrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: any; // Using any here for quick MVP integration with your existing types
}

export function MirrorModal({ isOpen, onClose, member }: MirrorModalProps) {
  const [executing, setExecuting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Mocking the specific allocation for the Queen Ant based on solid VCP setups
  const basket = [
    { ticker: "COALINDIA", weight: 40, thesis: "Volume breakout" },
    { ticker: "CIEINDIA", weight: 35, thesis: "VCP contraction" },
    { ticker: "ANURAS", weight: 25, thesis: "Base building" },
  ];

  const handleMirror = async () => {
    setExecuting(true);
    try {
      // Re-using our execution endpoint for the MVP
      await executeProtectedTrade("Queen Ant Basket");
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2500);
    } catch (e) {
      alert("Execution failed. Check backend.");
    } finally {
      setExecuting(false);
    }
  };

  if (!isOpen || !member) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative w-full max-w-app rounded-t-3xl bg-elevated px-6 pb-8 pt-4 sm:rounded-3xl"
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
            <button onClick={onClose} className="rounded-full bg-surface p-1.5 text-muted hover:text-primary">
              <X size={20} />
            </button>
          </div>

          <p className="mt-4 text-[14px] leading-relaxed text-secondary border-l-2 border-gold pl-3">
            "{member.note || "Focusing on tight consolidations and strong cash flows."}"
          </p>

          <div className="mt-6">
            <p className="text-label uppercase text-muted mb-3">Live Allocation</p>
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

          <div className="mt-8">
            {success ? (
              <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-dim py-4 text-[15px] font-bold text-teal">
                <Check size={20} strokeWidth={3} />
                Basket Mirrored & Protected
              </div>
            ) : (
              <Button onClick={handleMirror} disabled={executing} className="w-full flex items-center justify-center gap-2 py-4">
                {executing ? (
                  <Loader2 size={18} className="animate-spin text-ink" />
                ) : (
                  <Copy size={18} strokeWidth={2.5} className="text-ink" />
                )}
                Mirror with 8% Trailing Stop-Loss
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}