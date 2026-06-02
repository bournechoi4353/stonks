import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Recommendation } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { fmtDate, fmtMarketCap, fmtNum, fmtPct, fmtPrice } from "../format";
import { PriceChart } from "./PriceChart";
import { DayStats } from "./DayStats";
import { SignalList } from "./SignalList";
import { RecommendationCard, type RecStatus } from "./RecommendationCard";
import { HistoryPanel } from "./HistoryPanel";

interface Props {
  symbol: string;
  inWatchlist: boolean;
  onAdd: (symbol: string) => void;
  onRecLoaded: () => void;
}

export function StockView({ symbol, inWatchlist, onAdd, onRecLoaded }: Props) {
  const snap = useAsync(() => api.snapshot(symbol), [symbol]);
  const sig = useAsync(() => api.signals(symbol), [symbol]);

  // Recommendation is OPT-IN (the AI call costs subscription usage), so it does not auto-load.
  const [rec, setRec] = useState<{ status: RecStatus; data?: Recommendation; error?: string }>({ status: "idle" });
  // Monotonic request id: any newer request (symbol change OR Refresh) invalidates older
  // in-flight ones, so a slow response can never overwrite a newer symbol's card.
  const reqId = useRef(0);
  const loadRec = useCallback(
    (refresh: boolean) => {
      const myId = ++reqId.current;
      setRec({ status: "loading" });
      api
        .recommend(symbol, refresh)
        .then((d) => {
          if (myId === reqId.current) {
            setRec({ status: "done", data: d });
            onRecLoaded(); // refresh the track record / history
          }
        })
        .catch((e: unknown) => {
          if (myId === reqId.current) setRec({ status: "error", error: e instanceof Error ? e.message : String(e) });
        });
    },
    [symbol, onRecLoaded]
  );
  // Reset to idle when the symbol changes — no auto-fetch, so browsing stocks costs nothing.
  useEffect(() => {
    reqId.current++; // invalidate any in-flight request from the previous symbol
    setRec({ status: "idle" });
  }, [symbol]);

  const q = snap.data?.quote;
  const f = snap.data?.fundamentals;
  const news = snap.data?.news ?? [];
  const up = (q?.change_percent ?? 0) >= 0;

  return (
    <div className="stockview">
      <header className="sv-head">
        <div>
          <h2>
            {symbol} {q?.name && <span className="muted">· {q.name}</span>}
          </h2>
          {snap.loading && <p className="muted">Loading…</p>}
          {snap.error && <p className="status-error">{snap.error}</p>}
          {q && (
            <div className="price-row">
              <span className="price">{fmtPrice(q.price, q.currency)}</span>
              <span className={up ? "up" : "down"}>
                {fmtPrice(q.change, q.currency)} ({fmtPct(q.change_percent)})
              </span>
            </div>
          )}
        </div>
        <button className="ghost" disabled={inWatchlist} onClick={() => onAdd(symbol)}>
          {inWatchlist ? "★ In watchlist" : "☆ Add to watchlist"}
        </button>
      </header>

      <RecommendationCard status={rec.status} rec={rec.data} error={rec.error} onRun={loadRec} />

      <HistoryPanel symbol={symbol} refreshKey={rec.data?.generated_at} />

      <PriceChart symbol={symbol} />

      {q && <DayStats quote={q} />}

      {sig.loading && <p className="muted">Computing signals…</p>}
      {sig.error && <p className="status-error">{sig.error}</p>}
      {sig.data && <SignalList sheet={sig.data} />}

      {f && (
        <div className="card">
          <h3>Fundamentals</h3>
          <div className="facts">
            <Fact k="Sector" v={f.sector} />
            <Fact k="Industry" v={f.industry} />
            <Fact k="Market cap" v={fmtMarketCap(f.market_cap)} />
            <Fact k="Trailing P/E" v={f.trailing_pe != null ? f.trailing_pe.toString() : "—"} />
            <Fact k="Forward P/E" v={f.forward_pe != null ? f.forward_pe.toString() : "—"} />
            <Fact k="Beta" v={f.beta != null ? f.beta.toString() : "—"} />
            <Fact k="Div yield" v={f.dividend_yield != null ? `${f.dividend_yield}%` : "—"} />
            <Fact k="52w range" v={`${fmtNum(f.fifty_two_week_low)} – ${fmtNum(f.fifty_two_week_high)}`} />
          </div>
          {f.summary && <p className="summary muted">{f.summary}</p>}
        </div>
      )}

      <div className="card">
        <h3>Recent news</h3>
        {news.length === 0 && <p className="muted">No recent news.</p>}
        <ul className="news">
          {news.map((n, i) => (
            <li key={i}>
              {n.link ? (
                <a href={n.link} target="_blank" rel="noreferrer">
                  {n.title}
                </a>
              ) : (
                <span>{n.title}</span>
              )}
              <div className="muted news-meta">
                {n.publisher}
                {n.published_at ? ` · ${fmtDate(n.published_at)}` : ""}
              </div>
              {n.summary && <p className="news-sum">{n.summary}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="fact">
      <span className="muted">{k}</span>
      <span>{v || "—"}</span>
    </div>
  );
}
