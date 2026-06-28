"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, PieChart, Users, TrendingUp, User, type LucideIcon } from "lucide-react";
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
  { href: "/tribes", label: "Tribes", icon: Users },
  { href: "/rank", label: "Rank", icon: TrendingUp },
  { href: "/profile", label: "Profile", icon: User },
];

/**
 * Bottom navigation. Active tab shows a gold icon + label; inactive tabs show
 * a muted icon only. No top border — it dissolves into the background via a
 * gradient mask (.nav-fade).
 *
 * It stays HIDDEN on /home until the user has analyzed a portfolio — the empty
 * and processing states are a focused onboarding moment. Once results exist,
 * the nav slides up into view.
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
      className="nav-fade fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-app px-4 pb-5 pt-8"
    >
      <ul className="flex items-end justify-between">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className="flex flex-col items-center gap-1 py-1"
                aria-current={active ? "page" : undefined}
              >
                <motion.span whileTap={{ scale: 0.85 }} className="flex flex-col items-center gap-1">
                  <Icon
                    size={23}
                    strokeWidth={active ? 2.6 : 2.1}
                    className={cn(active ? "text-gold" : "text-muted")}
                  />
                  {active && (
                    <span className="text-[10px] font-bold tracking-wide text-gold">{tab.label}</span>
                  )}
                </motion.span>
              </Link>
            </li>
          );
        })}
      </ul>
    </motion.nav>
  );
}
