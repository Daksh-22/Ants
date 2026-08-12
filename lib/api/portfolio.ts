/**
 * Ants API client — every backend call in one place.
 *
 * API_BASE comes from NEXT_PUBLIC_API_URL (deployed) or localhost:8000 (dev).
 * Callers must catch. Failures surface to the user as failures — the app no
 * longer substitutes the built-in demo analysis for a real one.
 */

import type { Analysis } from "@/lib/analysis/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * Free-tier hosting spins the backend down when idle, so the first request
 * after a quiet period pays a cold start. Without a ceiling, a hung socket
 * left the Processing screen waiting forever with no cancel and no back.
 */
const DEFAULT_TIMEOUT_MS = 45_000;

export class ApiTimeoutError extends Error {
  constructor() {
    super("The server is taking too long to respond.");
    this.name = "ApiTimeoutError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal });
    if (!res.ok) {
      const detail = await res.json().then((b) => b?.detail).catch(() => null);
      throw new Error(detail || `${res.status} on ${path}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw new ApiTimeoutError();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Analysis ────────────────────────────────────────────────────────────────

export interface RawPosition {
  ticker: string;
  qty: number;
  avg: number;
}

/** Manual positions → full analysis (engine math + AI copy when enabled). */
export function analyzePositions(positions: RawPosition[]): Promise<Analysis> {
  return request<Analysis>("/api/analyze", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ positions, source: "manual" }),
  });
}

/**
 * Holdings screenshot → Claude-vision OCR → analysis, in one shot.
 * Prefer extractHoldingsFromScreenshot: it lets the user confirm what was read
 * before an analysis is built on it. Throws when the read fails — it no longer
 * returns the demo portfolio dressed up as your screenshot.
 */
export async function analyzeScreenshot(file: File): Promise<Analysis> {
  const form = new FormData();
  form.append("file", file);
  return request<Analysis>("/api/ocr/screenshot", { method: "POST", body: form });
}

export interface ExtractedHoldings {
  holdings: RawPosition[];
  /** ai_vision (accurate, needs a key) | tesseract (free, rougher) | none */
  method: "ai_vision" | "tesseract" | "none";
  note?: string;
}

/**
 * Screenshot → best-effort extracted holdings for the user to REVIEW before
 * analysis runs — never a final answer on its own. Free OCR (tesseract) is
 * meaningfully less accurate than AI vision, so the caller should route the
 * result into an editable form rather than trusting it blindly.
 */
export async function extractHoldingsFromScreenshot(file: File): Promise<ExtractedHoldings> {
  const form = new FormData();
  form.append("file", file);
  return request<ExtractedHoldings>("/api/ocr/extract", { method: "POST", body: form });
}

// ─── Ticker resolution (entry-time validation) ──────────────────────────────

export interface ResolvedTicker {
  input: string;
  ticker: string;
  found: boolean;
  name: string | null;
  sector: string | null;
  cmp: number | null;
  priceSource: "live" | "reference" | "unpriced";
}

/**
 * Confirm symbols before they reach an analysis.
 *
 * An unresolvable ticker doesn't fail — it falls back to the user's own average
 * price, so a typo renders as a real holding sitting at exactly 0.0% and still
 * counts toward totals, weights and concentration checks. Resolving at entry
 * turns that silent corruption into a visible "we couldn't find that".
 */
export function resolveTickers(tickers: string[]): Promise<{ results: ResolvedTicker[] }> {
  return request<{ results: ResolvedTicker[] }>("/api/resolve", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ tickers }),
  });
}

// ─── Risk metrics (real, from price history) ────────────────────────────────

export interface RiskReply {
  /** null when no holding had enough price history to measure */
  risk: {
    volatility_pct: number;
    sharpe_ratio: number;
    max_drawdown_pct: number;
    beta_vs_nifty: number | null;
    risk_score: number;
  } | null;
  holdingVolatilities: {
    ticker: string;
    sector: string;
    volatility_pct: number;
    contribution_to_portfolio_risk: number;
  }[];
  /** share of portfolio weight these numbers actually cover */
  coveragePct: number;
  note?: string;
}

/**
 * Real volatility / beta / drawdown, computed server-side from a year of daily
 * closes. Replaces a client-side sector→volatility lookup whose table was
 * missing 10 of the 22 sector labels the backend emits, so most holdings took
 * a 22% default and the risk screen barely moved between portfolios.
 */
export function fetchRiskMetrics(positions: RawPosition[]): Promise<RiskReply> {
  return request<RiskReply>("/api/metrics", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ positions, source: "insights" }),
  });
}

// ─── Index benchmarks (live) ────────────────────────────────────────────────

export interface IndexBenchmark {
  label: string;
  symbol: string;
  returnPct: number;
  /** trading date the close was taken from */
  asOf: string;
}

export interface BenchmarksReply {
  available: boolean;
  indexes: Partial<Record<"nifty50" | "sensex" | "midCap", IndexBenchmark>>;
  note?: string | null;
}

/**
 * Trailing 1-year index returns. Callers MUST handle available:false by
 * hiding the comparison — never by substituting a placeholder. These numbers
 * were hardcoded before, and the Nifty figure had the wrong sign.
 */
export function fetchBenchmarks(): Promise<BenchmarksReply> {
  return request<BenchmarksReply>("/api/benchmarks");
}

// ─── Ask Ants (AI + RAG) ─────────────────────────────────────────────────────

export interface ChatSource {
  source: string;
  title: string;
}

export interface ChatReply {
  answer: string;
  sources: ChatSource[];
  aiUsed: boolean;
}

export function askAnts(question: string, analysis?: Analysis | null): Promise<ChatReply> {
  return request<ChatReply>("/api/chat", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ question, analysis: analysis ?? undefined }),
  });
}

// ─── Tip Check (the pre-buy gut check) ──────────────────────────────────────

export interface TipCheckResult {
  ticker: string;
  name: string;
  sector: string | null;
  known: boolean;
  cmp: number | null;
  /** % of the portfolio already in this exact stock (null if not held) */
  alreadyOwnWeightPct: number | null;
  /** current return on the existing position, if held */
  ownReturnPct: number | null;
  /** sector weight today vs after a simulated buy of simulatedBuyPct */
  sectorWeightNow: number | null;
  sectorWeightAfter: number | null;
  simulatedBuyPct: number;
  tone: "ok" | "caution" | "warn";
  verdict: string;
}

/** Run a tip past the engine: what would buying this do to YOUR portfolio? */
export function checkTip(ticker: string, positions: RawPosition[]): Promise<TipCheckResult> {
  return request<TipCheckResult>("/api/check", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ ticker, positions }),
  });
}
