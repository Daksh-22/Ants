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

/** Initials circle. Default purple — the social layer color. */
export function Avatar({ initials, color = "purple", size = 28, className }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-primary",
        colorClasses[color],
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) }}
    >
      {initials}
    </span>
  );
}
