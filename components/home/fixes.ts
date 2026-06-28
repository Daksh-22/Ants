/**
 * The actionable fixes behind the results-screen breakdown. Each links an
 * action button to a "fix sheet" with a concrete before→after impact, and a
 * score delta that climbs the health ring when marked done.
 */

export const BASE_SCORE = 72;

export interface Fix {
  id: string;
  /** title shown at the top of the fix sheet */
  sheetTitle: string;
  /** how much the health score improves when this is done */
  scoreDelta: number;
  /** the headline metric this fix moves */
  metricLabel: string;
  metricBefore: string;
  metricAfter: string;
  /** the steps to actually do it */
  steps: string[];
  /** rough effort, shown under the steps */
  effort: string;
  /** counts toward the "N things need your attention" tally (the red/amber cards) */
  isAttentionItem: boolean;
}

export const FIXES: Fix[] = [
  {
    id: "concentration",
    sheetTitle: "Trim HDFC + Reliance",
    scoreDelta: 9,
    metricLabel: "In 2 boomer stocks",
    metricBefore: "24%",
    metricAfter: "11%",
    steps: [
      "Sell about half of your HDFC Bank and Reliance.",
      "Redeploy into the AI infra thesis you actually believe in.",
      "Target each name below 12% of your portfolio.",
    ],
    effort: "2–3 sell orders",
    isAttentionItem: true,
  },
  {
    id: "pgim-direct",
    sheetTitle: "PGIM Flexi Cap → Direct",
    scoreDelta: 5,
    metricLabel: "Yearly cost",
    metricBefore: "₹387",
    metricAfter: "₹0",
    steps: [
      "Open PGIM on your platform or the AMC site.",
      "Switch PGIM Flexi Cap from Regular to Direct.",
      "Same fund. Zero distributor cut.",
    ],
    effort: "~4 min on the AMC site",
    isAttentionItem: true,
  },
  {
    id: "overlap",
    sheetTitle: "Cut the fund overlap",
    scoreDelta: 5,
    metricLabel: "Shared holdings",
    metricBefore: "31%",
    metricAfter: "12%",
    steps: [
      "Pick one of Mirae Large Cap / Quant Small Cap to keep.",
      "Move the other into a fund with genuinely different holdings.",
      "Now you own 2 funds, not 1.4.",
    ],
    effort: "1 switch",
    isAttentionItem: true,
  },
  {
    id: "international-etf",
    sheetTitle: "Add an international ETF",
    scoreDelta: 5,
    metricLabel: "Global exposure",
    metricBefore: "~3%",
    metricAfter: "10%",
    steps: [
      "Start a small SIP into a global / US ETF.",
      "Mirae FANG+ is a taste — broaden beyond it.",
      "Diversifies you out of India-only risk.",
    ],
    effort: "1 new SIP",
    isAttentionItem: false,
  },
];

export const getFix = (id: string | null): Fix | null =>
  id ? FIXES.find((f) => f.id === id) ?? null : null;
