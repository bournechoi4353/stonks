import { useMemo, useState, type ReactElement } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type Candle } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { fmtDate, fmtDateTime, fmtTime } from "../format";
import { macd as calcMacd, rsi as calcRsi } from "../indicators";

const PRESETS = [
  { key: "1D", period: "1d", interval: "5m", intraday: true },
  { key: "5D", period: "5d", interval: "30m", intraday: true },
  { key: "1M", period: "1mo", interval: "1d", intraday: false },
  { key: "6M", period: "6mo", interval: "1d", intraday: false },
  { key: "1Y", period: "1y", interval: "1d", intraday: false },
];

type ChartType = "area" | "candles";

const GREEN = "#3fb950";
const RED = "#f85149";
const GRID = "#1f2a3a";
const AXIS = "#8b949e";
const BLUE = "#2f81f7";
const AMBER = "#d29922";
const PURPLE = "#a371f7";
const MARGIN = { top: 4, right: 10, left: 0, bottom: 0 };
const Y_WIDTH = 55;

interface Row {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  wick: [number, number];
  rsi: number | null;
  macd: number;
  macdSignal: number;
  macdHist: number;
  upDay: boolean;
}

function buildRows(candles: Candle[]): Row[] {
  const closes: number[] = [];
  let last = 0;
  for (const c of candles) {
    const v = c.close ?? last;
    closes.push(v);
    last = v;
  }
  const rsiArr = calcRsi(closes, 14);
  const m = calcMacd(closes);
  return candles.map((c, i) => ({
    date: c.date,
    open: c.open ?? null,
    high: c.high ?? null,
    low: c.low ?? null,
    close: c.close ?? null,
    volume: c.volume ?? null,
    wick: [c.low ?? c.close ?? 0, c.high ?? c.close ?? 0] as [number, number],
    rsi: rsiArr[i],
    macd: m.line[i],
    macdSignal: m.signal[i],
    macdHist: m.hist[i],
    upDay: (c.close ?? 0) >= (c.open ?? c.close ?? 0),
  }));
}

export function PriceChart({ symbol }: { symbol: string }) {
  const [presetKey, setPresetKey] = useState("6M");
  const [chartType, setChartType] = useState<ChartType>("area");
  const [panels, setPanels] = useState({ volume: true, rsi: true, macd: false });
  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[3];

  const { loading, data, error } = useAsync(
    () => api.history(symbol, preset.period, preset.interval),
    [symbol, preset.period, preset.interval]
  );

  const rows = useMemo(() => buildRows(data?.candles ?? []), [data]);

  const closes = rows.map((r) => r.close).filter((c): c is number => c != null);
  const up = closes.length > 1 ? closes[closes.length - 1] >= closes[0] : true;
  const priceColor = up ? GREEN : RED;

  const lows = rows.map((r) => r.low).filter((c): c is number => c != null);
  const highs = rows.map((r) => r.high).filter((c): c is number => c != null);
  const candleDomain: [number, number] | undefined = lows.length
    ? [Math.min(...lows) * 0.995, Math.max(...highs) * 1.005]
    : undefined;

  const xFmt = preset.period === "1d" ? fmtTime : fmtDate;
  const labelFmt = preset.intraday ? fmtDateTime : fmtDate;
  const syncId = `pc-${symbol}`;

  const sub: string[] = [];
  if (panels.volume) sub.push("volume");
  if (panels.rsi) sub.push("rsi");
  if (panels.macd) sub.push("macd");
  const bottom = sub.length ? sub[sub.length - 1] : "price";

  const togglePanel = (key: "volume" | "rsi" | "macd") => setPanels((p) => ({ ...p, [key]: !p[key] }));

  const xAxis = (key: string) => (
    <XAxis
      dataKey="date"
      hide={bottom !== key}
      tick={{ fill: AXIS, fontSize: 12 }}
      minTickGap={40}
      tickFormatter={(v) => xFmt(String(v))}
    />
  );

  return (
    <div className="card chart">
      <div className="chart-head">
        <h3>Price</h3>
        <div className="chart-controls">
          <div className="period-toggle">
            {PRESETS.map((p) => (
              <button key={p.key} className={p.key === presetKey ? "active" : ""} onClick={() => setPresetKey(p.key)}>
                {p.key}
              </button>
            ))}
          </div>
          <div className="period-toggle">
            <button className={chartType === "area" ? "active" : ""} onClick={() => setChartType("area")}>
              Line
            </button>
            <button className={chartType === "candles" ? "active" : ""} onClick={() => setChartType("candles")}>
              Candles
            </button>
          </div>
          <div className="period-toggle">
            {(["volume", "rsi", "macd"] as const).map((k) => (
              <button key={k} className={panels[k] ? "active" : ""} onClick={() => togglePanel(k)}>
                {k.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <p className="muted">Loading chart…</p>}
      {error && <p className="status-error">{error}</p>}
      {!loading && !error && rows.length === 0 && <p className="muted">No price data for this range.</p>}

      {!loading && !error && rows.length > 0 && (
        <>
          {/* Price panel */}
          <ResponsiveContainer width="100%" height={panels.volume || panels.rsi || panels.macd ? 240 : 300}>
            <ComposedChart data={rows} margin={MARGIN} syncId={syncId}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              {xAxis("price")}
              <YAxis
                domain={chartType === "candles" ? candleDomain ?? ["auto", "auto"] : ["auto", "auto"]}
                tick={{ fill: AXIS, fontSize: 12 }}
                width={Y_WIDTH}
                tickFormatter={(v) => Number(v).toFixed(0)}
              />
              {chartType === "area" ? (
                <>
                  <defs>
                    <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={priceColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={priceColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={tipStyle}
                    labelFormatter={(l) => labelFmt(String(l))}
                    formatter={(v) => [Number(v).toFixed(2), "Close"]}
                  />
                  <Area type="linear" dataKey="close" stroke={priceColor} fill="url(#priceFill)" strokeWidth={1.6} isAnimationActive={false} />
                </>
              ) : (
                <>
                  <Tooltip content={<CandleTooltip labelFmt={labelFmt} />} />
                  <Bar dataKey="wick" shape={<CandleShape />} isAnimationActive={false} />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>

          {/* Volume panel */}
          {panels.volume && (
            <Panel label="Volume">
              <ComposedChart data={rows} margin={MARGIN} syncId={syncId}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                {xAxis("volume")}
                <YAxis tick={{ fill: AXIS, fontSize: 11 }} width={Y_WIDTH} tickFormatter={fmtCompact} />
                <Tooltip contentStyle={tipStyle} labelFormatter={(l) => labelFmt(String(l))} formatter={(v) => [fmtCompact(Number(v)), "Volume"]} />
                <Bar dataKey="volume" shape={<VolumeShape />} isAnimationActive={false} />
              </ComposedChart>
            </Panel>
          )}

          {/* RSI panel */}
          {panels.rsi && (
            <Panel label="RSI (14)">
              <ComposedChart data={rows} margin={MARGIN} syncId={syncId}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                {xAxis("rsi")}
                <YAxis domain={[0, 100]} ticks={[30, 50, 70]} tick={{ fill: AXIS, fontSize: 11 }} width={Y_WIDTH} />
                <ReferenceLine y={70} stroke={RED} strokeDasharray="2 2" />
                <ReferenceLine y={30} stroke={GREEN} strokeDasharray="2 2" />
                <Tooltip contentStyle={tipStyle} labelFormatter={(l) => labelFmt(String(l))} formatter={(v) => [Number(v).toFixed(1), "RSI"]} />
                <Line type="linear" dataKey="rsi" stroke={PURPLE} dot={false} strokeWidth={1.4} isAnimationActive={false} connectNulls />
              </ComposedChart>
            </Panel>
          )}

          {/* MACD panel */}
          {panels.macd && (
            <Panel label="MACD (12,26,9)">
              <ComposedChart data={rows} margin={MARGIN} syncId={syncId}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                {xAxis("macd")}
                <YAxis tick={{ fill: AXIS, fontSize: 11 }} width={Y_WIDTH} tickFormatter={(v) => Number(v).toFixed(1)} />
                <ReferenceLine y={0} stroke="#3a4252" />
                <Tooltip contentStyle={tipStyle} labelFormatter={(l) => labelFmt(String(l))} formatter={(v, n) => [Number(v).toFixed(2), String(n)]} />
                <Bar dataKey="macdHist" shape={<MacdShape />} isAnimationActive={false} />
                <Line type="linear" dataKey="macd" stroke={BLUE} dot={false} strokeWidth={1.3} isAnimationActive={false} connectNulls />
                <Line type="linear" dataKey="macdSignal" stroke={AMBER} dot={false} strokeWidth={1.3} isAnimationActive={false} connectNulls />
              </ComposedChart>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

const tipStyle = { background: "#0b0f17", border: `1px solid ${GRID}`, borderRadius: 2 } as const;

function fmtCompact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

function Panel({ label, children }: { label: string; children: ReactElement }) {
  return (
    <div className="panel">
      <span className="panel-label">{label}</span>
      <ResponsiveContainer width="100%" height={label.startsWith("MACD") ? 110 : 92}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

// Candlestick: recharts gives the pixel box for [low, high]; interpolate open/close within it.
function CandleShape(props: any) {
  const { x, y, width, height, payload } = props;
  const { open, high, low, close } = payload ?? {};
  if (open == null || high == null || low == null || close == null) return null;
  const upCandle = close >= open;
  const fill = upCandle ? GREEN : RED;
  const cx = x + width / 2;
  const range = high - low;
  const yLow = y + height;
  const pxPer = range > 0 ? height / range : 0;
  const openPx = range > 0 ? yLow - (open - low) * pxPer : y;
  const closePx = range > 0 ? yLow - (close - low) * pxPer : y;
  const bodyTop = Math.min(openPx, closePx);
  const bodyH = Math.max(Math.abs(closePx - openPx), 1);
  const bodyW = Math.max(width * 0.6, 1);
  return (
    <g shapeRendering="crispEdges">
      <line x1={cx} x2={cx} y1={y} y2={yLow} stroke={fill} strokeWidth={1} />
      <rect x={cx - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={fill} />
    </g>
  );
}

function VolumeShape(props: any) {
  const { x, y, width, height, payload } = props;
  const fill = payload?.upDay ? GREEN : RED;
  return <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.45} shapeRendering="crispEdges" />;
}

function MacdShape(props: any) {
  const { x, y, width, height, payload } = props;
  const fill = (payload?.macdHist ?? 0) >= 0 ? GREEN : RED;
  return <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.6} shapeRendering="crispEdges" />;
}

function CandleTooltip(props: any) {
  const { active, payload, labelFmt } = props;
  if (!active || !payload || !payload.length) return null;
  const c = payload[0].payload;
  if (c.open == null) return null;
  return (
    <div className="candle-tip">
      <div className="muted">{labelFmt(String(c.date))}</div>
      <div>
        O {c.open.toFixed(2)} &nbsp; H {c.high.toFixed(2)}
      </div>
      <div>
        L {c.low.toFixed(2)} &nbsp; C {c.close.toFixed(2)}
      </div>
    </div>
  );
}
