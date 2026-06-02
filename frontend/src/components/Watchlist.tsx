import type { WatchlistItem } from "../api/client";
import { fmtPrice, fmtPct } from "../format";

interface Props {
  items: WatchlistItem[];
  selected: string;
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}

export function Watchlist({ items, selected, onSelect, onRemove }: Props) {
  if (!items.length) {
    return <p className="muted">Watchlist empty. Search a ticker, then add it.</p>;
  }
  return (
    <ul className="watchlist">
      {items.map((it) => {
        const up = (it.change_percent ?? 0) >= 0;
        return (
          <li
            key={it.symbol}
            className={it.symbol === selected ? "wl-item active" : "wl-item"}
            onClick={() => onSelect(it.symbol)}
          >
            <div className="wl-main">
              <span className="wl-sym">{it.symbol}</span>
              {it.error ? (
                <span className="wl-err">{it.error}</span>
              ) : (
                <span className={`badge bias-${it.bias}`}>
                  {it.bias} {it.signal_score?.toFixed(2)}
                </span>
              )}
            </div>
            <div className="wl-sub">
              {it.error ? (
                <span className="muted">—</span>
              ) : (
                <>
                  <span>{fmtPrice(it.price)}</span>
                  <span className={up ? "up" : "down"}>{fmtPct(it.change_percent)}</span>
                </>
              )}
            </div>
            <button
              className="wl-x"
              title={`Remove ${it.symbol}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(it.symbol);
              }}
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}
