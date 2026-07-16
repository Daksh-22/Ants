import type { MarketInsight } from "./types";
import type { AnalysisHolding } from "@/lib/analysis/types";

/**
 * Curated market insights — hardcoded for MVP (swap for a news API later).
 * Each is tagged with a sector so the feed can rank by relevance to the
 * user's actual holdings. Dates are intentionally omitted from display;
 * these are evergreen-ish sector reads, not breaking news.
 */
export const INSIGHT_POOL: MarketInsight[] = [
  {
    id: "it-rate-cuts",
    title: "IT rallies when US rates blink",
    body: "Indian IT earns in dollars and sells to American budgets. Every hint of a US rate cut loosens those budgets — which is why TCS and Infosys move on Fed minutes more than on their own earnings. If IT is your biggest sector, you're partly holding a bet on US monetary policy.",
    source: "sector-news",
    sector: "IT",
    relevance_score: 0,
    tags: ["Sector trend"],
    published_at: "2026-07-01",
  },
  {
    id: "bank-credit-cycle",
    title: "Banks are a bet on other people borrowing",
    body: "Bank profits track the credit cycle: when loan growth runs 14-15% and defaults stay low, banking stocks compound quietly. The thing to watch isn't the quarterly profit — it's gross NPA percentages creeping up. That number turns before the stock does.",
    source: "sector-news",
    sector: "Banking",
    relevance_score: 0,
    tags: ["Sector trend"],
    published_at: "2026-07-01",
  },
  {
    id: "defense-order-books",
    title: "Defense stocks run on order books, not orders",
    body: "HAL and BEL announce multi-year order books worth several times their annual revenue. The stock moves on the announcement; the revenue lands over a decade. That gap between headline and cash is where overexcitement lives — check the execution rate, not the order book size.",
    source: "sector-news",
    sector: "Defense",
    relevance_score: 0,
    tags: ["Sector trend"],
    published_at: "2026-07-01",
  },
  {
    id: "consumer-tech-profitability",
    title: "Consumer tech's new religion: profits",
    body: "Zomato and Paytm spent years burning cash for growth; the market now pays for EBITDA, not GMV. Quarterly profitability is the whole story — one bad margin quarter and these names drop 15% in a week. Highest-volatility sector on the board. Size positions accordingly.",
    source: "sector-news",
    sector: "Consumer Tech",
    relevance_score: 0,
    tags: ["Sector trend"],
    published_at: "2026-07-01",
  },
  {
    id: "electronics-pli",
    title: "Electronics manufacturing rides on subsidies",
    body: "Dixon, Kaynes and Syrma grew up inside the PLI subsidy scheme. The scheme works — but it has an expiry date, and margins without subsidies are the real test. When you hold EMS stocks, know how much of the margin is policy and how much is business.",
    source: "sector-news",
    sector: "Electronics",
    relevance_score: 0,
    tags: ["Sector trend"],
    published_at: "2026-07-01",
  },
  {
    id: "railways-capex",
    title: "Railway stocks are a government budget line",
    body: "RVNL and IRFC move with the railway capex allocation in the Union Budget — one number, once a year, sets the sector's mood. Between budgets they drift on order announcements. If railways is a big slice of your portfolio, February is your earnings season.",
    source: "sector-news",
    sector: "Railways",
    relevance_score: 0,
    tags: ["Sector trend"],
    published_at: "2026-07-01",
  },
  {
    id: "auto-ev-transition",
    title: "Auto's EV pivot is expensive before it's profitable",
    body: "Tata Motors and M&M are spending heavily on EV platforms while petrol still pays the bills. The transition costs margin today for market share tomorrow. Watch EV mix percentage each quarter — it tells you whether the bet is landing.",
    source: "sector-news",
    sector: "Auto",
    relevance_score: 0,
    tags: ["Sector trend"],
    published_at: "2026-07-01",
  },
  {
    id: "fmcg-rural",
    title: "FMCG is a rural India thermometer",
    body: "HUL and ITC volumes track rural demand — monsoon quality, crop prices, village wages. When rural India has money, FMCG compounds boringly. It's the lowest-volatility sector you can own, which is exactly why it feels dull in bull markets and brilliant in crashes.",
    source: "sector-news",
    sector: "FMCG",
    relevance_score: 0,
    tags: ["Sector trend"],
    published_at: "2026-07-01",
  },
  {
    id: "pharma-us-pricing",
    title: "Pharma's US generics grind",
    body: "Sun Pharma and Cipla earn a big chunk from US generics, where prices only go down. The growth story is specialty drugs and India's domestic market. If your pharma holding is all generics exposure, you own a treadmill, not an escalator.",
    source: "sector-news",
    sector: "Pharma",
    relevance_score: 0,
    tags: ["Sector trend"],
    published_at: "2026-07-01",
  },
  {
    id: "energy-refining-margins",
    title: "Reliance is three companies in a trenchcoat",
    body: "Refining margins, telecom ARPU, and retail expansion — RIL moves on whichever story is loudest this quarter. Holding it means holding a conglomerate bet. The upside: it diversifies you internally. The downside: you can't own it for just one thesis.",
    source: "sector-news",
    sector: "Energy",
    relevance_score: 0,
    tags: ["Sector trend"],
    published_at: "2026-07-01",
  },
  {
    id: "macro-sip-flows",
    title: "₹23,000 crore a month has your back",
    body: "Monthly SIP flows into Indian equity keep making record highs. That's structural demand that cushions every dip — one reason Indian corrections have been shallower lately. It also means valuations stay expensive. Domestic flows are the market's floor AND its ceiling.",
    source: "macro-alert",
    relevance_score: 0,
    tags: ["Market macro"],
    published_at: "2026-07-01",
  },
  {
    id: "macro-concentration",
    title: "Most portfolios fail the same way",
    body: "The most common retail portfolio mistake isn't picking bad stocks — it's over-concentration in whatever sector was hot when you started investing. 2021 starters are IT-heavy, 2023 starters are defense-heavy, 2024 starters loaded railways. Check what year your portfolio thinks it is.",
    source: "macro-alert",
    relevance_score: 0,
    tags: ["Market macro"],
    published_at: "2026-07-01",
  },
];

/**
 * Rank insights by relevance to the user's holdings: sector insights score by
 * the user's weight in that sector; macro insights get a steady baseline so a
 * couple always surface. Returns the top `k` with relevance filled in.
 */
export function rankInsights(holdings: AnalysisHolding[], k = 5): MarketInsight[] {
  const sectorWeight = new Map<string, number>();
  for (const h of holdings) {
    sectorWeight.set(h.sector, (sectorWeight.get(h.sector) ?? 0) + h.weightPct);
  }

  return INSIGHT_POOL.map((ins) => {
    const weight = ins.sector ? sectorWeight.get(ins.sector) ?? 0 : 25; // macro baseline
    const inPortfolio = ins.sector != null && weight > 0;
    return {
      ...ins,
      relevance_score: Math.round(Math.min(100, weight * 2)),
      tags: inPortfolio ? ["Your portfolio", ...ins.tags] : ins.tags,
    };
  })
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, k);
}
