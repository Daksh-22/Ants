"use client";

import { useEffect, useRef, useState } from "react";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animate a number from its current value up to `target` over `duration` ms,
 * easing out. Every scoreboard number in Ants counts up on mount.
 *
 * Returns the live numeric value — the caller formats it (formatINR /
 * formatPercent). Respects prefers-reduced-motion by jumping straight to target.
 * If `target` changes (e.g. a slider), it re-animates from the current value.
 *
 * Correctness note: the animated value is what the user reads, so it must land
 * on `target` under every condition, not just the happy path. Browsers pause
 * requestAnimationFrame in hidden tabs — so a user who switched to their broker
 * app mid-entry and came back used to find every number in the app stranded at
 * ₹0, because the animation had never advanced past its first frame. Two
 * guards below make the final value unconditional: skip animating entirely
 * while hidden, and back every run with a timer that force-lands the target.
 */
export function useCountUp(target: number, duration = 1200, onComplete?: () => void): number {
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // keep a ref of the latest rendered value so re-animations start from "now"
  valueRef.current = value;

  // Re-sync when the tab comes back. While hidden, rAF is throttled to a crawl
  // or paused outright, so whatever was on screen is stale by the time the user
  // returns. Snap to the truth rather than resuming a half-finished animation.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) setValue(target);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [target]);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Nothing to watch in a hidden tab, and rAF won't run — go straight there.
    if (reduced || (typeof document !== "undefined" && document.hidden)) {
      setValue(target);
      onCompleteRef.current?.();
      return;
    }

    const from = valueRef.current;
    let start: number | null = null;

    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min((now - start) / duration, 1);
      setValue(from + (target - from) * easeOutCubic(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else onCompleteRef.current?.();
    };

    rafRef.current = requestAnimationFrame(tick);

    // Safety net: if rAF is throttled, descheduled, or the tab is hidden
    // mid-flight, land on the exact target anyway. Without this a stalled
    // animation leaves a number the user reads as real but isn't.
    timeoutRef.current = setTimeout(() => {
      setValue(target);
      onCompleteRef.current?.();
    }, duration + 250);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}
