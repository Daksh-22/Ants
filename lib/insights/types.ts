/**
 * Risk & Analytics Types
 * Extends the Analysis object with deeper risk metrics and benchmarking data
 */

export interface RiskMetrics {
  volatility_pct: number; // Annualized portfolio volatility %
  /**
   * Excess return / volatility, both on a trailing 1-year horizon (6% risk-free).
   * null when unmeasurable. This used to divide return-SINCE-PURCHASE by an
   * ANNUALISED volatility, inflating a multi-year gain into a Sharpe of 4.56.
   */
  sharpe_ratio: number | null;
  max_drawdown_pct: number; // Worst peak-to-trough decline %
  /** null when too few holdings had overlapping history to measure it —
   *  render as unavailable, never as 0 */
  beta_vs_nifty: number | null;
  risk_score: number; // 0-100 (0=high risk, 100=low risk)
}

export interface HoldingVolatility {
  ticker: string;
  sector: string;
  volatility_pct: number; // Sector volatility %
  contribution_to_portfolio_risk: number; // This holding's % contribution to portfolio risk
}

export interface BenchmarkComparison {
  user_return_pct: number; // User's portfolio return %
  nifty50_return_pct: number; // Nifty 50 return %
  sensex_return_pct: number; // Sensex (BSE) return %
  nifty_midcap_return_pct: number; // Nifty Midcap 150 return %
  outperformance: {
    vs_nifty50: number; // User - Nifty (can be negative)
    vs_sensex: number;
    vs_nifty_midcap: number;
  };
  /**
   * Percentile against other Ants users, or null when we can't compute one.
   * Null is the normal case today: ranking a user against peers needs a real
   * cohort of real users. This was previously pinned at 72, which rendered a
   * gold "Top 28%" trophy for every single user.
   */
  rank_percentile: number | null;
}

export interface SectorMetrics {
  sector: string;
  holdings_count: number;
  /** how many of those holdings we could actually price */
  priced_count: number;
  weight_pct: number; // Portfolio weight %, computed from the live analysis
  /**
   * Money-weighted return over the PRICED holdings only. null when none of the
   * sector's holdings could be priced — render that as unavailable, never as 0.
   */
  return_pct: number | null;
  // volatility_pct removed: it came from a hardcoded sector table that was
  // missing most of the sector labels the backend emits, so it resolved to a
  // 22.0% constant for the majority of holdings. Real per-ticker volatility
  // now comes from GET /api/metrics (see RiskReply.holdingVolatilities).
}

export interface WatchlistItem {
  ticker: string;
  name: string;
  sector: string | null;
  cmp: number | null; // current price from the reference table (null = unknown ticker)
  fit_score: number; // 0-100, how well it fits THIS portfolio (from the tip-check engine)
  tone: "ok" | "caution" | "warn";
  verdict: string; // the engine's verdict, in the Ants voice
  added_at: string; // ISO date
}

export interface MarketInsight {
  id: string;
  title: string;
  body: string;
  source: string; // "sector-news", "macro-alert", "holding-update"
  sector?: string; // if sector-related
  relevance_score: number; // 0-100, how relevant to user's portfolio
  tags: string[]; // ["Your portfolio", "Sector trend", "Market macro"]
  published_at: string; // ISO date
}

export interface PriceAlert {
  ticker: string;
  buy_target?: number; // Trigger price for buy alert
  sell_target?: number; // Trigger price for sell alert
  /** cmp at the moment the alert was created — the progress-bar baseline.
   *  Older alerts saved before this field existed fall back gracefully. */
  created_price?: number;
  created_at: string; // ISO date
  status: "active" | "triggered" | "cancelled";
  triggered_at?: string; // ISO date when alert fired
}

export interface InsightsState {
  risk_metrics: RiskMetrics | null;
  benchmarks: BenchmarkComparison | null;
  sector_metrics: SectorMetrics[];
  holding_volatilities: HoldingVolatility[];
  watchlist: WatchlistItem[];
  market_insights: MarketInsight[];
  price_alerts: PriceAlert[];
  last_updated: string; // ISO date
}
