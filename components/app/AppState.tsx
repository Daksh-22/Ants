"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const ANALYZED_KEY = "ants:portfolio-analyzed";
const FIXES_KEY = "ants:done-fixes";

interface AppState {
  /** has the user uploaded/analyzed a portfolio yet? drives /home + bottom nav */
  analyzed: boolean;
  /** false until we've read localStorage on the client — avoids empty→results flash */
  hydrated: boolean;
  /** ids of fixes the user has marked done — drives the health score + card states */
  doneFixes: string[];
  setAnalyzed: (value: boolean) => void;
  markFixDone: (id: string) => void;
  /** wipe everything — used by "Scan a different portfolio" */
  reset: () => void;
}

const AppStateContext = createContext<AppState | null>(null);

function readFixes(): string[] {
  try {
    const raw = localStorage.getItem(FIXES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [analyzed, setAnalyzedState] = useState(false);
  const [doneFixes, setDoneFixes] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setAnalyzedState(localStorage.getItem(ANALYZED_KEY) === "true");
      setDoneFixes(readFixes());
    } catch {
      // localStorage unavailable — stay in the empty state
    }
    setHydrated(true);
  }, []);

  const setAnalyzed = (value: boolean) => {
    setAnalyzedState(value);
    try {
      if (value) localStorage.setItem(ANALYZED_KEY, "true");
      else localStorage.removeItem(ANALYZED_KEY);
    } catch {
      // ignore persistence failures
    }
  };

  const markFixDone = (id: string) => {
    setDoneFixes((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(FIXES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const reset = () => {
    setAnalyzedState(false);
    setDoneFixes([]);
    try {
      localStorage.removeItem(ANALYZED_KEY);
      localStorage.removeItem(FIXES_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <AppStateContext.Provider
      value={{ analyzed, hydrated, doneFixes, setAnalyzed, markFixDone, reset }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within an AppStateProvider");
  return ctx;
}
