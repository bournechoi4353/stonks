import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type PriceHistory } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { fmtDate } from "../format";

const PALETTE = ["#2f81f7", "#3fb950", "#f85149", "#d29922", "#a371f7", "#39c5cf", "#db61a2", "#e3b341"];
const PERIODS = ["1mo", "6mo", "1y"];

type Row = Record<string, number | string>;

// Merge several histories into one date-keyed table of % change from each series' start.
function merge(series: { s: string; h: PriceHistory | null }[]): Row[] {
  const byDate = new Map<string, Row>();
  for (const { s, h } of series) {
    if (!h || !h.candles.length) continue;
    const base = h.candles.find((c) => c.close != null)?.close;
    if (!base) continue;
    for (const c of h.candles) {
      if (c.close == null) continue;
      const row = byDate.get(c.date) ?? { date: c.date };
      row[s] = (c.close / base - 1) * 100;
      byDate.set(c.date, row);
    }
  }
  return Array.from(byDate.values()).sort((a, b) => (String(a.date) < String(b.date) ? -1 : 1));
}

export function CompareChart({ symbols }: { symbols: string[] }) {
  const [picked, setPicked] = useState<string[]>(() => symbols.slice(0, 5));
  const [period, setPeriod] = useState("6mo");
  const active = picked.filter((s) => symbols.includes(s));

  const { loading, data, error } = useAsync(async () => {
    const res = await Promise.all(
      active.map((s) =>
        api
          .history(s, period, "1d")
          .then((h) => ({ s, h }))
          .catch(() => ({ s, h: null as PriceHistory | null }))
      )
    );
    return merge(res);
  }, [active.join(","), period]);

  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  return (
    <div className="card chart">
      <div className="chart-head">
        <h3>Compare — % change</h3>
        <div className="period-toggle">
          {PERIODS.map((p) => (
            <button key={p} className={p === period ? "active" : ""} onClick={() => setPeriod(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="chip-row">
        {symbols.map((s) => {
          const idx = active.indexOf(s);
          const on = idx >= 0;
          return (
            <button
              key={s}
              className={`chip-toggle ${on ? "on" : ""}`}
              style={on ? { borderColor: PALETTE[idx % PALETTE.length], color: PALETTE[idx % PALETTE.length] } : undefined}
              onClick={() => toggle(s)}
            >
              {s}
            </button>
          );
        })}
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="status-error">{error}</p>}
      {!loading && active.length === 0 && <p className="muted">Pick one or more symbols above to compare.</p>}

      {!loading && !error && active.length > 0 && data && data.length > 0 && (
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2a3a" />
            <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 12 }} minTickGap={40} tickFormatter={(v) => fmtDate(String(v))} />
            <YAxis tick={{ fill: "#8b949e", fontSize: 12 }} width={55} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} />
            <ReferenceLine y={0} stroke="#3a4252" />
            <Tooltip
              contentStyle={{ background: "#0b0f17", border: "1px solid #1f2a3a", borderRadius: 2 }}
              labelFormatter={(l) => fmtDate(String(l))}
              formatter={(v, n) => [`${Number(v).toFixed(2)}%`, n]}
            />
            <Legend />
            {active.map((s, i) => (
              <Line key={s} type="linear" dataKey={s} stroke={PALETTE[i % PALETTE.length]} dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="muted">Each line is % change from the start of the range, so different-priced stocks are comparable.</p>
    </div>
  );
}
