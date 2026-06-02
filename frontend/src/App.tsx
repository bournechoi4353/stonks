import { useCallback, useEffect, useState } from "react";
import { api, type WatchlistItem } from "./api/client";
import { SearchBar } from "./components/SearchBar";
import { Watchlist } from "./components/Watchlist";
import { StockView } from "./components/StockView";
import { TrackRecord } from "./components/TrackRecord";
import { ChartGrid } from "./components/ChartGrid";
import { CompareChart } from "./components/CompareChart";
import { Help } from "./components/Help";
import "./index.css";

type ViewMode = "single" | "grid" | "compare" | "help";
const VIEWS: { key: ViewMode; label: string }[] = [
  { key: "single", label: "Stock" },
  { key: "grid", label: "Grid" },
  { key: "compare", label: "Compare" },
  { key: "help", label: "Help" },
];

export default function App() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [selected, setSelected] = useState("AAPL");
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [wlError, setWlError] = useState<string>();
  const [recRefresh, setRecRefresh] = useState(0);

  const loadWatchlist = useCallback(() => {
    api
      .watchlist()
      .then(setWatchlist)
      .catch((e: unknown) => setWlError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(() => loadWatchlist(), [loadWatchlist]);

  // Open a single stock's full view.
  const showSingle = useCallback((s: string) => {
    const sym = s.trim().toUpperCase();
    if (!sym) return;
    setSelected(sym);
    setViewMode("single");
  }, []);

  const addSymbol = useCallback((s: string) => {
    const sym = s.trim().toUpperCase();
    if (!sym) return;
    api
      .addWatchlist(sym)
      .then(setWatchlist)
      .catch((e: unknown) => setWlError(e instanceof Error ? e.message : String(e)));
  }, []);

  const removeSymbol = useCallback((s: string) => {
    api
      .removeWatchlist(s)
      .then((items) => {
        setWatchlist(items);
        setSelected((prev) => (prev === s ? items[0]?.symbol ?? "" : prev));
      })
      .catch((e: unknown) => setWlError(e instanceof Error ? e.message : String(e)));
  }, []);

  const onRecLoaded = useCallback(() => setRecRefresh((n) => n + 1), []);

  const inWatchlist = watchlist.some((i) => i.symbol === selected);
  const symbols = watchlist.map((i) => i.symbol);

  return (
    <div className="app">
      <header className="topbar">
        <h1>📈 Stonks</h1>
        <nav className="viewbar">
          {VIEWS.map((v) => (
            <button key={v.key} className={v.key === viewMode ? "active" : ""} onClick={() => setViewMode(v.key)}>
              {v.label}
            </button>
          ))}
        </nav>
        <span className="disclaimer">
          Recommender only — never trades. <strong>Not financial advice.</strong>
        </span>
      </header>

      <div className={viewMode === "help" ? "layout full" : "layout"}>
        {viewMode !== "help" && (
          <aside className="sidebar">
            <SearchBar onSubmit={showSingle} />
            {wlError && <p className="status-error">{wlError}</p>}
            <Watchlist items={watchlist} selected={selected} onSelect={showSingle} onRemove={removeSymbol} />
            <TrackRecord refreshKey={recRefresh} />
          </aside>
        )}

        <main className="main">
          {viewMode === "single" &&
            (selected ? (
              <StockView symbol={selected} inWatchlist={inWatchlist} onAdd={addSymbol} onRecLoaded={onRecLoaded} />
            ) : (
              <p className="muted">Search a ticker to begin.</p>
            ))}
          {viewMode === "grid" && <ChartGrid items={watchlist} onSelect={showSingle} />}
          {viewMode === "compare" && <CompareChart symbols={symbols} />}
          {viewMode === "help" && <Help />}
        </main>
      </div>
    </div>
  );
}
