import { useState } from "react";
import { api, type WatchlistItem } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { fmtPct, fmtPrice } from "../format";
import { MiniChart } from "./MiniChart";

function GridTile({ item, onSelect }: { item: WatchlistItem; onSelect: (s: string) => void }) {
  const { data } = useAsync(() => api.history(item.symbol, "6mo", "1d"), [item.symbol]);
  const up = (item.change_percent ?? 0) >= 0;
  return (
    <div className="tile" onClick={() => onSelect(item.symbol)} role="button" tabIndex={0}>
      <div className="tile-head">
        <span className="tile-sym">{item.symbol}</span>
        {item.error ? (
          <span className="wl-err">{item.error}</span>
        ) : (
          item.bias && <span className={`badge bias-${item.bias}`}>{item.bias}</span>
        )}
      </div>
      <div className="tile-sub">
        <span>{fmtPrice(item.price)}</span>
        <span className={up ? "up" : "down"}>{fmtPct(item.change_percent)}</span>
      </div>
      <MiniChart candles={data?.candles ?? []} />
    </div>
  );
}

export function ChartGrid({ items, onSelect }: { items: WatchlistItem[]; onSelect: (s: string) => void }) {
  const [cols, setCols] = useState(2);
  if (!items.length) return <p className="muted">Add stocks to your watchlist to see them here.</p>;

  return (
    <div>
      <div className="chart-head">
        <h3>All charts</h3>
        <div className="period-toggle">
          {[1, 2, 3].map((n) => (
            <button key={n} className={n === cols ? "active" : ""} onClick={() => setCols(n)}>
              {n} col
            </button>
          ))}
        </div>
      </div>
      <div className="chart-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {items.map((it) => (
          <GridTile key={it.symbol} item={it} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
