"use client";

import { motion } from "framer-motion";
import { Bell } from "lucide-react";

/** Home top bar: "Ants" gold wordmark + notification bell with an unread gold dot. */
export function Header({ unread = true }: { unread?: boolean }) {
  return (
    <header className="flex items-center justify-between px-5 pt-5">
      <span className="text-[20px] font-extrabold tracking-tight text-gold">Ants</span>
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        aria-label="Notifications"
        className="relative -m-2 p-2 text-primary"
      >
        <Bell size={22} strokeWidth={2.2} />
        {unread && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold ring-2 ring-base" />
        )}
      </motion.button>
    </header>
  );
}
