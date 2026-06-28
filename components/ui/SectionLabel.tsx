import { cn } from "@/lib/utils/cn";

/**
 * The uppercase caption style — 11px, 600, letter-spacing 0.8px, muted.
 * Used for cohort labels and small section captions.
 */
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-label uppercase text-muted",
        className
      )}
    >
      {children}
    </p>
  );
}
