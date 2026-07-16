"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, PieChart, BarChart3, Users, TrendingUp, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAppState } from "@/components/app/AppState";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

const tabs: Tab[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/tribes", label: "Tribes", icon: Users },
  { href: "/rank", label: "Rank", icon: TrendingUp },
  { href: "/profile", label: "Profile", icon: User },
];

/**
 * Bottom navigation — a floating frosted-glass dock. The active tab gets a
 * gold icon with a shared-layout pill that glides between tabs (layoutId),
 * plus a glow dot underneath. Inactive tabs are muted icons.
 *
 * It stays HIDDEN on /home until the user has analyzed a portfolio — the empty
 * and processing states are a focused onboarding moment. Once results exist,
 * the dock springs up into view.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { analyzed } = useAppState();

  const onHome = pathname === "/home";
  const visible = !onHome || analyzed;
  if (!visible) return null;

  return (
    <motion.nav
      initial={{ y: 90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-app px-4 pb-4 pt-6 nav-fade"
    >
      <ul className="glass flex items-center justify-between rounded-[26px] px-2 py-2">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className="relative flex flex-col items-center py-1.5"
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute inset-x-1 -inset-y-0.5 rounded-2xl bg-gold-dim"
                  />
                )}
                <motion.span
                  whileTap={{ scale: 0.85 }}
                  className="relative flex flex-col items-center gap-0.5"
                >
                  <Icon
                    size={22}
                    strokeWidth={active ? 2.6 : 2}
                    className={cn(
                      "transition-colors duration-200",
                      active ? "text-gold drop-shadow-[0_0_8px_rgba(232,160,32,0.6)]" : "text-muted"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[9px] font-bold tracking-wide transition-colors duration-200",
                      active ? "text-gold" : "text-transparent"
                    )}
                  >
                    {tab.label}
                  </span>
                </motion.span>
              </Link>
            </li>
          );
        })}
      </ul>
    </motion.nav>
  );
}
