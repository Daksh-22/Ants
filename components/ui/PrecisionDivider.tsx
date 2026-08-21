"use client";

/**
 * Precision divider — visual separator with grid alignment
 * Emphasizes structure and signal separation
 */
export function PrecisionDivider() {
  return (
    <div className="relative w-full h-16 flex items-center justify-center">
      {/* background grid */}
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: `
          linear-gradient(0deg, rgba(232,160,32,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(232,160,32,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '32px 32px',
      }} />

      {/* center divider line */}
      <div className="relative h-px w-full bg-gradient-to-r from-transparent via-[rgba(232,160,32,0.2)] to-transparent" />

      {/* corner accents */}
      <div className="absolute left-0 top-1/2 w-1 h-1 bg-[rgba(232,160,32,0.3)] rounded-full transform -translate-y-1/2" />
      <div className="absolute right-0 top-1/2 w-1 h-1 bg-[rgba(232,160,32,0.3)] rounded-full transform -translate-y-1/2" />
    </div>
  );
}
