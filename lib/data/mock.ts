/**
 * All mock data for Ants. One source of truth — Arjun Mehta's world.
 * Numbers are taken verbatim from the product spec so the app feels real.
 */

// ─────────────────────────── User ───────────────────────────
export interface User {
  name: string;
  age: number;
  city: string;
  broker: string;
  riskProfile: string;
  handle: string;
  initials: string;
}

export const user: User = {
  name: "Arjun Mehta",
  age: 24,
  city: "Bengaluru",
  broker: "Zerodha",
  riskProfile: "Aggressive",
  handle: "@arjun_compounds",
  initials: "AM",
};

// ─────────────────────────── Portfolio summary ───────────────────────────
export interface PortfolioSummary {
  totalValue: number;
  invested: number;
  returnsAbs: number;
  returnsPct: number;
  todayAbs: number;
  todayPct: number;
}

export const portfolio: PortfolioSummary = {
  totalValue: 187420,
  invested: 154000,
  returnsAbs: 33420,
  returnsPct: 21.7,
  todayAbs: 1240,
  todayPct: 0.67,
};

// ─────────────────────────── Holdings ───────────────────────────
export interface Holding {
  name: string;
  sector: string;
  shares: number;
  avg: number;
  cmp: number;
  /** unit label — "shares" or "units" for ETFs */
  unit: string;
}

export interface ComputedHolding extends Holding {
  value: number;
  investedValue: number;
  returnPct: number;
}

const rawHoldings: Holding[] = [
  { name: "Kaynes Technology", sector: "Electronics", shares: 5, avg: 2890, cmp: 4120, unit: "shares" },
  { name: "Dixon Technologies", sector: "Electronics", shares: 2, avg: 10200, cmp: 14340, unit: "shares" },
  { name: "Mirae FANG+ ETF", sector: "ETF", shares: 15, avg: 68, cmp: 94, unit: "units" },
  { name: "TCS", sector: "IT", shares: 3, avg: 3680, cmp: 4127, unit: "shares" },
  { name: "Infosys", sector: "IT", shares: 8, avg: 1445, cmp: 1612, unit: "shares" },
  { name: "HDFC Bank", sector: "Banking", shares: 10, avg: 1590, cmp: 1628, unit: "shares" },
  { name: "Reliance", sector: "Energy", shares: 4, avg: 2890, cmp: 2943, unit: "shares" },
];

/** Holdings with derived value / invested / return %, sorted winners-first. */
export const holdings: ComputedHolding[] = rawHoldings
  .map((h) => {
    const value = h.shares * h.cmp;
    const investedValue = h.shares * h.avg;
    const returnPct = ((h.cmp - h.avg) / h.avg) * 100;
    return { ...h, value, investedValue, returnPct };
  })
  .sort((a, b) => b.returnPct - a.returnPct);

/** Sum of holding values — used to compute each holding's portfolio weight. */
export const holdingsTotalValue = holdings.reduce((sum, h) => sum + h.value, 0);

// ─────────────────────────── SIPs ───────────────────────────
export interface Sip {
  name: string;
  plan: "Direct" | "Regular";
  monthly: number;
  months: number;
  returnPct: number;
  /** true when this SIP needs the user's attention (e.g. a Regular plan) */
  flag?: boolean;
}

export const sips: Sip[] = [
  { name: "Mirae Asset Large Cap", plan: "Direct", monthly: 3000, months: 18, returnPct: 14.2 },
  { name: "Quant Small Cap", plan: "Direct", monthly: 2000, months: 12, returnPct: 28.4 },
  { name: "PGIM Flexi Cap", plan: "Regular", monthly: 1500, months: 9, returnPct: 8.4, flag: true },
];

// ─────────────────────────── Rank ───────────────────────────
export interface RankPosition {
  percentile: number; // "Top X%"
  label?: string;
}

export const rank = {
  cohort: "Investors aged 22–27 · Bengaluru",
  wealthPercentile: 22,
  wealthPrevPercentile: 25, // last month — improvement of 3 points
  returnsPercentile: 17,
  // the leaderboard strip, top (best) to bottom
  strip: [
    { percentile: 10 },
    { percentile: 17, label: "Returns rank" },
    { percentile: 22, label: "You" }, // highlighted gold — Arjun
    { percentile: 35 },
    { percentile: 50 },
  ] as RankPosition[],
  movers: [
    { label: "SIP consistency", delta: 1.8 },
    { label: "Portfolio returns", delta: 1.2 },
  ],
};

// ─────────────────────────── Tribe (the user's) ───────────────────────────
export interface TribeMember {
  initials: string;
  handle: string;
  ytd: number;
  note?: string;
}

export const tribe = {
  name: "AI Infrastructure",
  members: 18420,
  avgReturn: 31.4,
  conviction: 8.4,
  membershipMonths: 4,
  leaderboard: [
    { initials: "SS", handle: "@sid_builds_wealth", ytd: 67.2, note: "Dixon was my highest conviction call. Still is." },
    { initials: "PM", handle: "@growthmode_priya", ytd: 52.1, note: "Added more Kaynes on every dip." },
    { initials: "AK", handle: "@ai_india_bull", ytd: 44.8 },
  ] as TribeMember[],
};

// ─────────────────────────── Tribe activity feed (home) ───────────────────────────
export interface FeedTag {
  label: string;
  tone: "neutral" | "gain";
}

export interface FeedPost {
  initials: string;
  handle: string;
  time: string;
  body: string;
  tags: FeedTag[];
  fire: number;
  comments: number;
}

export const feed: FeedPost[] = [
  {
    initials: "SS",
    handle: "@sid_builds_wealth",
    time: "2h ago",
    body: "Added to Kaynes today. PCB demand from Apple supply chain diversification isn't priced in yet. This is 18 months early.",
    tags: [
      { label: "Kaynes Technology", tone: "neutral" },
      { label: "+42.6% in portfolio", tone: "gain" },
    ],
    fire: 47,
    comments: 12,
  },
  {
    initials: "PM",
    handle: "@growthmode_priya",
    time: "5h ago",
    body: "NVIDIA Q2 guidance just dropped. Mirae FANG+ ETF is the cleanest way to play this without US demat complexity.",
    tags: [
      { label: "Mirae FANG+ ETF", tone: "neutral" },
      { label: "+38.2% in portfolio", tone: "gain" },
    ],
    fire: 89,
    comments: 23,
  },
  {
    initials: "AK",
    handle: "@ai_india_bull",
    time: "Yesterday",
    body: "Dixon vs Kaynes: I've held both since March. Dixon has better management bandwidth. Kaynes has better margins. I'm 60-40 Dixon.",
    tags: [
      { label: "Dixon Technologies", tone: "neutral" },
      { label: "Kaynes Technology", tone: "neutral" },
    ],
    fire: 134,
    comments: 41,
  },
];

// ─────────────────────────── Discover other tribes ───────────────────────────
export interface DiscoverTribe {
  name: string;
  membersLabel: string;
  avgReturn: number;
}

export const discoverTribes: DiscoverTribe[] = [
  { name: "PSU Capex", membersLabel: "24k ants", avgReturn: 18.2 },
  { name: "India Pharma", membersLabel: "11k ants", avgReturn: 14.7 },
  { name: "EV Revolution", membersLabel: "8k ants", avgReturn: 9.1 },
  { name: "US Tech", membersLabel: "6k ants", avgReturn: 31.8 },
];
