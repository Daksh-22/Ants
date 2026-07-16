"use client";

import { motion } from "framer-motion";
import type { Achievement } from "@/lib/gamification/types";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

interface AchievementCardProps {
  achievement: Achievement;
  index?: number;
  isLocked?: boolean;
  progress?: { current: number; max: number };
}

/**
 * One badge. Unlocked = gold left border (a milestone, so it earns the gold);
 * locked = dimmed with a progress bar showing how close it is.
 */
export function AchievementCard({
  achievement,
  index = 0,
  isLocked = false,
  progress,
}: AchievementCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 280, damping: 24 }}
    >
      <Card
        className={cn(
          "border-l-[3px]",
          isLocked ? "border-strong opacity-55" : "border-gold bg-gold-faint"
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl",
              isLocked ? "bg-elevated grayscale" : "bg-gold-dim ring-1 ring-gold/30"
            )}
          >
            {achievement.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-primary">{achievement.name}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-muted">{achievement.description}</p>

            {isLocked && progress && progress.max > 1 && (
              <div className="mt-2.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (progress.current / progress.max) * 100)}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 22, delay: 0.2 }}
                    className="h-full rounded-full bg-gold"
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted tabular">
                  {progress.current} / {progress.max}
                </p>
              </div>
            )}

            {!isLocked && achievement.unlockedAt && (
              <p className="mt-2 text-[11px] font-semibold text-gold">
                ✓ Unlocked {new Date(achievement.unlockedAt).toLocaleDateString("en-IN")}
              </p>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
