/**
 * Risk & Analytics Types
 * Extends the Analysis object with deeper risk metrics and benchmarking data
 */

export interface RiskMetrics {
  volatility_pct: number; // Annualized portfolio volatility %
  sharpe_ratio: number; // Return / volatility (using 6% risk-free rate)
  max_drawdown_pct: number; // Worst peak-to-trough decline %
  beta_vs_nifty: number; // Portfolio beta vs Nifty 50
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
  nifty_micro_cap_return_pct: number; // Nifty Micro Cap return %
  outperformance: {
    vs_nifty50: number; // User - Nifty (can be negative)
    vs_sensex: number;
    vs_nifty_micro_cap: number;
  };
  rank_percentile: number; // 0-100, where 100 = top performer among all users
}

export interface SectorMetrics {
  sector: string;
  holdings_count: number;
  weight_pct: number; // Portfolio weight %
  return_pct: number; // Sector's average return
  volatility_pct: number; // Sector volatility
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
