/**
 * Ants API client — every backend call in one place.
 *
 * API_BASE comes from NEXT_PUBLIC_API_URL (deployed) or localhost:8000 (dev).
 * A deployed build still pointing at loopback fails fast with a message that
 * names the missing variable, rather than an opaque "Failed to fetch".
 *
 * Callers must catch. Failures surface to the user as failures — the app no
 * longer substitutes the built-in demo analysis for a real one.
 */

import type { Analysis } from "@/lib/analysis/types";

const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL?.trim();

export const API_BASE = CONFIGURED_API_URL || "http://localhost:8000";

const JSON_HEADERS = { "Content-Type": "application/json" };

function isLoopback(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
}

/**
 * A deployed build with NEXT_PUBLIC_API_URL unset — or still pointing at
 * localhost — used to fall through to localhost:8000 and fail on every call
 * with an opaque "Failed to fetch". That reads to the user as "the app is
 * broken" when it's one missing dashboard variable, and it reads to us as a
 * network blip. NEXT_PUBLIC_* is inlined at build time, so this is decided
 * once at build and only ever wrong in one direction: a page served from a
 * real host that is trying to reach the developer's own laptop.
 */
function configError(): string | null {
  if (typeof window === "undefined") return null;
  if (isLoopback(window.location.hostname)) return null;

  let apiHost: string;
  try {
    apiHost = new URL(API_BASE).hostname;
  } catch {
    return `NEXT_PUBLIC_API_URL is not a valid URL ("${API_BASE}").`;
  }
  if (!isLoopback(apiHost)) return null;

  return CONFIGURED_API_URL
    ? `This build points at ${API_BASE}, which only exists on the developer's machine. Set NEXT_PUBLIC_API_URL to the deployed backend and redeploy.`
    : "NEXT_PUBLIC_API_URL was not set when this build was made, so the app is trying to reach a backend on your own machine. Set it in the hosting dashboard and redeploy.";
}

export class ApiNotConfiguredError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "ApiNotConfiguredError";
  }
}

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

/**
 * FastAPI's `detail` is a string for our own HTTPExceptions but a list of
 * {loc, msg, type} objects for 422 validation failures. Interpolating that
 * list into an Error put "[object Object]" in front of the user, which told
 * them nothing and told us nothing either.
 */
function messageFromDetail(detail: unknown, res: Response, path: string): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === "object" ? (d as { msg?: unknown }).msg : d))
      .filter((m): m is string => typeof m === "string" && m.trim().length > 0);
    if (msgs.length) return msgs.join("; ");
  }
  if (res.status >= 500) return "The server hit an error handling that. Try again in a moment.";
  return `${res.status} on ${path}`;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const misconfigured = configError();
  if (misconfigured) throw new ApiNotConfiguredError(misconfigured);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal });
    if (!res.ok) {
      const detail = await res.json().then((b) => b?.detail).catch(() => null);
      throw new Error(messageFromDetail(detail, res, path));
    }
    return (await res.json()) as T;
  } catch (err) {
    // undici and the browser disagree on AbortError's prototype, so match the
    // name rather than the class — otherwise a timeout escaped as a raw abort.
    if (err instanceof Error && err.name === "AbortError") throw new ApiTimeoutError();
    // fetch rejects with a bare TypeError for DNS/CORS/offline. "Failed to
    // fetch" on its own is the least actionable string in the product.
    if (err instanceof TypeError) {
      throw new Error(`Couldn't reach the Ants server at ${API_BASE}. Check your connection.`);
    }
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
  /** "reference" is retired — a stale hardcoded snapshot was being reported
   *  as a real valuation. It is live or nothing. */
  priceSource: "live" | "unpriced";
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

// ─── Live quotes (re-pricing on demand) ─────────────────────────────────────

export interface LiveQuote {
  price: number;
  source: "live" | "unpriced";
}

export interface QuotesReply {
  quotes: Record<string, LiveQuote>;
  asOf?: string;
}

/**
 * Current price per ticker, independent of any stored analysis.
 *
 * Price alerts are evaluated in the browser, and they used to compare targets
 * against the quote frozen into the last analysis — so a target could be crossed
 * hours ago and the alert would still read "not there yet" until the user
 * re-ran an analysis. This lets the alert sweep re-price first.
 *
 * Callers MUST skip any quote whose source is "unpriced": its price is 0 and
 * firing an alert against it would invent a crossing that never happened.
 */
export function fetchLiveQuotes(tickers: string[]): Promise<QuotesReply> {
  return request<QuotesReply>("/api/quotes", {
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
    /** null when the trailing window needed to match the volatility horizon
     *  wasn't measurable — omit the line rather than mixing horizons */
    sharpe_ratio: number | null;
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

// ─── Anonymous cohort ranking ────────────────────────────────────────────────

export interface RankReply {
  available: boolean;
  /** only present when available is true */
  percentile?: number;
  /** how many real analyses this was computed against */
  sampleSize: number;
}

/**
 * Where this return sits against every other anonymous analysis run through
 * the app. available:false until the server has enough real samples to make
 * a percentile honest — never substitute a placeholder for it.
 */
export function fetchRank(returnPct: number): Promise<RankReply> {
  return request<RankReply>(`/api/rank?returnPct=${encodeURIComponent(returnPct)}`);
}
