/**
 * Ants API client — every backend call in one place.
 *
 * API_BASE comes from NEXT_PUBLIC_API_URL (deployed) or localhost:8000 (dev).
 * Callers should catch — the app degrades to the built-in demo analysis when
 * the backend is unreachable, so no path hard-fails.
 */

import type { Analysis } from "@/lib/analysis/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
/** ws(s):// twin of API_BASE, for the Swarm Radar socket */
export const WS_BASE = API_BASE.replace(/^http/, "ws");

const JSON_HEADERS = { "Content-Type": "application/json" };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const detail = await res.json().then((b) => b?.detail).catch(() => null);
    throw new Error(detail || `${res.status} on ${path}`);
  }
  return res.json();
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

/** Holdings screenshot → Claude-vision OCR → analysis (demo fallback keyless). */
export async function analyzeScreenshot(file: File): Promise<Analysis> {
  const form = new FormData();
  form.append("file", file);
  return request<Analysis>("/api/ocr/screenshot", { method: "POST", body: form });
}

/** Broker path: AA consent (mock) then the data-ready webhook → analysis. */
export async function analyzeBroker(): Promise<Analysis> {
  const consent = await request<{ consentHandle: string }>("/api/aa/initiate-sync", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ userId: "user_123", mobile: "9999999999" }),
  });
  const ready = await request<{ analysis: Analysis }>(
    `/api/aa/webhook?consentHandle=${encodeURIComponent(consent.consentHandle)}`,
    { method: "POST" }
  );
  return ready.analysis;
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

// ─── Execution (Swarm Radar) ────────────────────────────────────────────────

export async function executeProtectedTrade(sector: string) {
  const symbolMap: Record<string, string> = {
    "AI Infra": "KAYNES",
    Defense: "HAL",
    Power: "TATAPOWER",
    EMS: "DIXON",
    Railways: "RVNL",
  };
  return request("/api/execution/order", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      symbol: symbolMap[sector] || "NIFTYBEES",
      qty: 10,
      price: 2500.0,
      order_type: "LIMIT",
    }),
  });
}

/** kept for compatibility with earlier callers */
export function initiateAccountAggregatorSync() {
  return request("/api/aa/initiate-sync", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ userId: "user_123", mobile: "9999999999" }),
  });
}
