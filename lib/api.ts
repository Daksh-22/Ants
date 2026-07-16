/**
 * API Client — All backend calls go through here.
 * Handles auth, errors, type safety, caching.
 */

import { Analysis, AnalysisHolding } from './analysis/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── State Management ────────────────────────────────────────────────────────

let authToken: string | null = null;

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (!authToken) {
    authToken = localStorage.getItem('auth_token');
  }
  return authToken;
}

export function setAuthToken(token: string) {
  authToken = token;
  localStorage.setItem('auth_token', token);
}

export function clearAuthToken() {
  authToken = null;
  localStorage.removeItem('auth_token');
}

// ─── HTTP Helpers ───────────────────────────────────────────────────────────

interface RequestOptions {
  method?: string;
  body?: any;
  requiresAuth?: boolean;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, requiresAuth = false } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getAuthToken();
  if (requiresAuth && token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (requiresAuth && !token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

// ─── Authentication ─────────────────────────────────────────────────────────

export interface User {
  user_id: string;
  email: string;
  name?: string;
}

export async function signup(email: string, password: string, name?: string) {
  const result = await request<{ access_token: string; user_id: string; email: string }>(
    '/api/auth/signup',
    {
      method: 'POST',
      body: { email, password, name },
    }
  );

  setAuthToken(result.access_token);
  return result;
}

export async function login(email: string, password: string) {
  const result = await request<{ access_token: string; user_id: string; email: string }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: { email, password },
    }
  );

  setAuthToken(result.access_token);
  return result;
}

export async function getProfile(): Promise<User> {
  return request('/api/auth/profile', { requiresAuth: true });
}

// ─── Portfolios ─────────────────────────────────────────────────────────────

export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export async function createPortfolio(name: string, description?: string): Promise<Portfolio> {
  return request('/api/portfolios', {
    method: 'POST',
    body: { name, description },
    requiresAuth: true,
  });
}

export async function getPortfolios(): Promise<Portfolio[]> {
  return request('/api/portfolios', { requiresAuth: true });
}

// ─── Holdings ───────────────────────────────────────────────────────────────

export interface Holding {
  id: string;
  ticker: string;
  qty: number;
  buy_price: number;
  sector: string;
  cmp?: number;
  current_value?: number;
  gain_loss?: number;
  gain_loss_pct?: number;
}

export async function addHolding(
  portfolioId: string,
  ticker: string,
  qty: number,
  buyPrice: number,
  sector: string
): Promise<Holding> {
  return request(`/api/portfolios/${portfolioId}/holdings`, {
    method: 'POST',
    body: { ticker, qty, buy_price: buyPrice, sector },
    requiresAuth: true,
  });
}

export async function getHoldings(portfolioId: string): Promise<Holding[]> {
  return request(`/api/portfolios/${portfolioId}/holdings`, { requiresAuth: true });
}

// ─── CSV Import ─────────────────────────────────────────────────────────────

export async function importCSV(portfolioName: string, file: File) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const formData = new FormData();
  formData.append('portfolio_name', portfolioName);
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/api/portfolios/import-csv`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Import failed: ${response.status}`);
  }

  return response.json();
}

// ─── Analysis ───────────────────────────────────────────────────────────────

export async function analyzePortfolio(portfolioId: string): Promise<Analysis> {
  return request(`/api/portfolios/${portfolioId}/analysis`, { requiresAuth: true });
}

// ─── Stock Prices ────────────────────────────────────────────────────────────

export interface StockPrice {
  ticker: string;
  cmp: number;
  change_pct: number;
  high_52w: number;
  low_52w: number;
  pe_ratio: number;
  fetched_at: string;
}

export async function getStockPrice(ticker: string): Promise<StockPrice | null> {
  try {
    return await request(`/api/prices/${ticker}`);
  } catch {
    return null;
  }
}

export async function getStockPrices(tickers: string[]): Promise<Record<string, StockPrice>> {
  try {
    return await request('/api/prices/batch', {
      method: 'POST',
      body: tickers,
    });
  } catch {
    return {};
  }
}

// ─── Gamification ───────────────────────────────────────────────────────────

export interface GamificationState {
  user_id: string;
  xp: number;
  level: number;
  streak_count: number;
  achievements: string[];
}

export async function earnXP(xpAmount: number): Promise<any> {
  return request('/api/gamification/xp', {
    method: 'POST',
    body: { xp_earned: xpAmount },
    requiresAuth: true,
  });
}

export async function getGamificationState(): Promise<GamificationState | null> {
  try {
    return await request('/api/gamification/state', { requiresAuth: true });
  } catch {
    return null;
  }
}

export async function unlockAchievement(achievementId: string): Promise<any> {
  return request(`/api/gamification/achievements/${achievementId}`, {
    method: 'POST',
    requiresAuth: true,
  });
}

// ─── Watchlist ──────────────────────────────────────────────────────────────

export interface WatchlistItem {
  ticker: string;
  fit_score: number;
}

export async function addToWatchlist(ticker: string, fitScore: number = 0): Promise<any> {
  return request('/api/watchlist', {
    method: 'POST',
    body: { ticker, fit_score: fitScore },
    requiresAuth: true,
  });
}

export async function getWatchlist(): Promise<WatchlistItem[]> {
  try {
    return await request('/api/watchlist', { requiresAuth: true });
  } catch {
    return [];
  }
}

// ─── Price Alerts ───────────────────────────────────────────────────────────

export interface PriceAlert {
  id: string;
  ticker: string;
  buy_target?: number;
  sell_target?: number;
  status: 'active' | 'triggered';
}

export async function createPriceAlert(
  ticker: string,
  buyTarget?: number,
  sellTarget?: number
): Promise<any> {
  return request('/api/price-alerts', {
    method: 'POST',
    body: { ticker, buy_target: buyTarget, sell_target: sellTarget },
    requiresAuth: true,
  });
}

export async function getPriceAlerts(): Promise<PriceAlert[]> {
  try {
    return await request('/api/price-alerts', { requiresAuth: true });
  } catch {
    return [];
  }
}

// ─── Fallback: Demo Mode ────────────────────────────────────────────────────

export async function getDemoAnalysis(): Promise<Analysis> {
  try {
    return await request('/api/analyze/demo');
  } catch {
    // Fallback to mock if backend down
    throw new Error('Backend unavailable');
  }
}
