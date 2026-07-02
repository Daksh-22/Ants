"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Analysis } from "@/lib/analysis/types";

const ANALYZED_KEY = "ants:portfolio-analyzed";
const FIXES_KEY = "ants:done-fixes";
const ANALYSIS_KEY = "ants:analysis";

interface AppState {
  /** has the user uploaded/analyzed a portfolio yet? drives /home + bottom nav */
  analyzed: boolean;
  /** false until we've read localStorage on the client — avoids empty→results flash */
  hydrated: boolean;
  /** ids of fixes the user has marked done — drives the health score + card states */
  doneFixes: string[];
  /** the personalized analysis from the backend; null → demo (DEFAULT_ANALYSIS) */
  analysis: Analysis | null;
  setAnalyzed: (value: boolean) => void;
  setAnalysis: (analysis: Analysis | null) => void;
  markFixDone: (id: string) => void;
  /** wipe everything — used by "Scan a different portfolio" */
  reset: () => void;
}

const AppStateContext = createContext<AppState | null>(null);

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [analyzed, setAnalyzedState] = useState(false);
  const [doneFixes, setDoneFixes] = useState<string[]>([]);
  const [analysis, setAnalysisState] = useState<Analysis | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setAnalyzedState(localStorage.getItem(ANALYZED_KEY) === "true");
      const fixes = readJSON<string[]>(FIXES_KEY);
      if (Array.isArray(fixes)) setDoneFixes(fixes.filter((x): x is string => typeof x === "string"));
      const stored = readJSON<Analysis>(ANALYSIS_KEY);
      if (stored && stored.summary && Array.isArray(stored.flags)) setAnalysisState(stored);
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

  const setAnalysis = (value: Analysis | null) => {
    setAnalysisState(value);
    try {
      if (value) localStorage.setItem(ANALYSIS_KEY, JSON.stringify(value));
      else localStorage.removeItem(ANALYSIS_KEY);
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
    setAnalysisState(null);
    try {
      localStorage.removeItem(ANALYZED_KEY);
      localStorage.removeItem(FIXES_KEY);
      localStorage.removeItem(ANALYSIS_KEY);
      localStorage.removeItem("ants:manual-positions");
    } catch {
      // ignore
    }
  };

  return (
    <AppStateContext.Provider
      value={{ analyzed, hydrated, doneFixes, analysis, setAnalyzed, setAnalysis, markFixDone, reset }}
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
