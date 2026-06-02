// Typed client for the backend API. Types mirror the backend Pydantic schemas
// (snake_case preserved). Requests hit /api/* and are proxied to FastAPI in dev.

export interface Quote {
  symbol: string;
  name?: string | null;
  price?: number | null;
  previous_close?: number | null;
  change?: number | null;
  change_percent?: number | null;
  open?: number | null;
  day_high?: number | null;
  day_low?: number | null;
  year_high?: number | null;
  year_low?: number | null;
  volume?: number | null;
  market_cap?: number | null;
  currency?: string | null;
  exchange?: string | null;
  as_of?: string | null;
}

export interface Candle {
  date: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
}

export interface PriceHistory {
  symbol: string;
  period: string;
  interval: string;
  candles: Candle[];
}

export interface Fundamentals {
  symbol: string;
  name?: string | null;
  sector?: string | null;
  industry?: string | null;
  trailing_pe?: number | null;
  forward_pe?: number | null;
  market_cap?: number | null;
  dividend_yield?: number | null;
  beta?: number | null;
  fifty_two_week_high?: number | null;
  fifty_two_week_low?: number | null;
  currency?: string | null;
  exchange?: string | null;
  website?: string | null;
  summary?: string | null;
}

export interface NewsItem {
  title: string;
  publisher?: string | null;
  link?: string | null;
  published_at?: string | null;
  summary?: string | null;
}

export interface StockSnapshot {
  symbol: string;
  quote: Quote;
  fundamentals?: Fundamentals | null;
  news: NewsItem[];
  history?: PriceHistory | null;
}

export interface IndicatorSignal {
  name: string;
  value?: number | null;
  signal: string; // bullish | bearish | neutral | insufficient
  detail: string;
  weight: number;
}

export interface SignalSheet {
  symbol: string;
  as_of: string;
  price?: number | null;
  score: number;
  bias: string;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  signals: IndicatorSignal[];
  metrics: Record<string, number | null>;
}

export interface Recommendation {
  symbol: string;
  name?: string | null;
  action: string; // Buy | Sell | Hold
  conviction: number; // 1..5
  time_horizon: string; // short | long
  news_sentiment: string; // positive | negative | mixed | neutral
  summary: string;
  reasoning: string[];
  risks: string[];
  price?: number | null;
  signal_score?: number | null;
  signal_bias?: string | null;
  model?: string | null;
  generated_at: string;
  disclaimer: string;
}

export interface WatchlistItem {
  symbol: string;
  name?: string | null;
  price?: number | null;
  change_percent?: number | null;
  signal_score?: number | null;
  bias?: string | null;
  error?: string | null;
}

export interface HistoryEntry {
  id: number;
  symbol: string;
  name?: string | null;
  action: string;
  conviction?: number | null;
  time_horizon?: string | null;
  news_sentiment?: string | null;
  summary?: string | null;
  reasoning: string[];
  risks: string[];
  price?: number | null;
  signal_score?: number | null;
  signal_bias?: string | null;
  model?: string | null;
  generated_at: string;
  current_price?: number | null;
  return_pct?: number | null;
  aligned?: boolean | null;
  days_ago?: number | null;
}

export interface HistorySummary {
  total: number;
  by_action: Record<string, number>;
  evaluated: number;
  aligned: number;
  hit_rate?: number | null;
  avg_return_pct?: number | null;
  avg_buy_return_pct?: number | null;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

const enc = encodeURIComponent;

export const api = {
  snapshot: (s: string) => http<StockSnapshot>(`/api/stocks/${enc(s)}/snapshot`),
  signals: (s: string) => http<SignalSheet>(`/api/stocks/${enc(s)}/signals`),
  history: (s: string, period: string, interval = "1d") =>
    http<PriceHistory>(`/api/stocks/${enc(s)}/history?period=${enc(period)}&interval=${enc(interval)}`),
  recommend: (s: string, refresh = false) =>
    http<Recommendation>(`/api/recommend/${enc(s)}${refresh ? "?refresh=true" : ""}`),
  watchlist: () => http<WatchlistItem[]>(`/api/watchlist`),
  addWatchlist: (s: string) =>
    http<WatchlistItem[]>(`/api/watchlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: s }),
    }),
  removeWatchlist: (s: string) => http<WatchlistItem[]>(`/api/watchlist/${enc(s)}`, { method: "DELETE" }),
  recHistory: (symbol?: string, limit = 200) =>
    http<HistoryEntry[]>(`/api/history?limit=${limit}${symbol ? `&symbol=${enc(symbol)}` : ""}`),
  historySummary: () => http<HistorySummary>(`/api/history/summary`),
};
