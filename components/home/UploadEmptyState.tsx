"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Upload, Lock } from "lucide-react";

const teasers = [
  "Portfolio concentration check",
  "SIP overlap and waste detection",
  "Your real vs stated risk profile",
];

/**
 * STATE 1 — what a brand-new user sees. A focused onboarding moment (no bottom
 * nav): upload a holdings screenshot to get a brutally honest breakdown.
 */
export function UploadEmptyState({ onStart }: { onStart: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-base">
      <div className="mx-auto flex min-h-full max-w-app flex-col justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* wordmark */}
          <p className="text-center text-[20px] font-extrabold text-gold">Ants</p>

          {/* headline */}
          <h1 className="mt-7 text-center text-[28px] font-bold leading-[1.2] tracking-[-0.5px] text-primary">
            What is your portfolio
            <br />
            actually doing?
          </h1>

          {/* subheading */}
          <p className="mx-auto mt-3 max-w-[320px] text-center text-[16px] leading-[1.6] text-secondary">
            Upload a screenshot from Groww, Zerodha, or Kuvera. We&apos;ll tell you the truth — not what
            you want to hear.
          </p>

          {/* hidden file input — any image triggers the (mocked) analysis */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={() => onStart()}
          />

          {/* upload zone */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-8 flex w-full animate-upload-breathe flex-col items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-gold-soft bg-gold-faint px-6 py-10 text-center"
          >
            <Upload size={32} strokeWidth={2.2} className="text-gold" />
            <span className="mt-1 text-[15px] font-medium text-primary">
              Tap to upload your holdings screenshot
            </span>
            <span className="text-[12px] text-muted">Groww · Zerodha · Kuvera · INDmoney</span>
          </button>

          {/* manual entry */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={onStart}
              className="text-[14px] font-medium text-gold underline underline-offset-2"
            >
              Or add your stocks manually
            </button>
          </div>

          {/* privacy */}
          <p className="mt-4 text-center text-[11px] text-muted">
            🔒 Your data stays on your device. We don&apos;t store screenshots.
          </p>

          {/* locked teasers — show the value before they commit */}
          <div className="mt-8 space-y-2.5">
            {teasers.map((label) => (
              <div
                key={label}
                className="flex h-16 items-center justify-between rounded-2xl bg-surface px-4 opacity-50"
              >
                <span className="text-[14px] font-medium text-secondary">{label}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted">
                  <Lock size={14} className="text-gold" />
                  Upload to unlock
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
