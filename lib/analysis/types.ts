/**
 * The Analysis contract — exactly what the backend engine returns
 * (backend/engine.py). The frontend renders this shape everywhere; demo mode
 * uses a generated constant of the same shape (default.ts).
 */

export interface AnalysisSummary {
  totalValue: number;
  invested: number;
  returnsAbs: number;
  returnsPct: number;
}

export interface FixPlan {
  id: string;
  sheetTitle: string;
  scoreDelta: number;
  metricLabel: string;
  metricBefore: string;
  metricAfter: string;
  steps: string[];
  effort: string;
}

export interface AnalysisFlag {
  id: string;
  severity: "red" | "amber";
  label: string;
  body: string;
  fix: FixPlan | null;
}

export interface AnalysisWorking {
  id: string;
  label: string;
  body: string;
}

export interface AnalysisMove {
  title: string;
  cta: string;
  fixId: string;
}

export interface AnalysisHolding {
  ticker: string;
  name: string;
  sector: string;
  qty: number;
  avg: number;
  cmp: number;
  value: number;
  invested: number;
  returnPct: number;
  weightPct: number;
  known: boolean;
}

export interface Analysis {
  source: string; // manual | screenshot | broker | demo | mcp
  generatedBy: "engine" | "ai";
  summary: AnalysisSummary;
  score: number;
  scoreLabel: string;
  attentionCount: number;
  flags: AnalysisFlag[];
  working: AnalysisWorking[];
  moves: AnalysisMove[];
  holdings: AnalysisHolding[];
  /** set by the OCR endpoint: whether AI actually read the screenshot */
  aiUsed?: boolean;
  note?: string;
}
