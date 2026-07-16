import { cn } from "@/lib/utils/cn";

type AvatarColor = "purple" | "gold" | "teal" | "amber";

interface AvatarProps {
  initials: string;
  color?: AvatarColor;
  /** diameter in px */
  size?: number;
  className?: string;
}

const colorClasses: Record<AvatarColor, string> = {
  purple: "bg-purple",
  gold: "bg-gold",
  teal: "bg-teal",
  amber: "bg-amber",
};

// gold/teal/amber are light fills — dark ink text keeps contrast readable.
// purple stays dark enough for cream text.
const textClasses: Record<AvatarColor, string> = {
  purple: "text-primary",
  gold: "text-ink",
  teal: "text-ink",
  amber: "text-ink",
};

/** Initials circle. Default purple — the social layer color. */
export function Avatar({ initials, color = "purple", size = 28, className }: AvatarProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ring-1 ring-white/10",
        colorClasses[color],
        textClasses[color],
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) }}
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
      <span className="relative">{initials}</span>
    </span>
  );
}
