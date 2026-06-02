import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { Candle } from "../api/client";

const GREEN = "#3fb950";
const RED = "#f85149";

// Compact sparkline used in the grid tiles — no axes, sharp linear line.
export function MiniChart({ candles }: { candles: Candle[] }) {
  const closes = candles.map((c) => c.close).filter((c): c is number => c != null);
  const up = closes.length > 1 ? closes[closes.length - 1] >= closes[0] : true;
  const color = up ? GREEN : RED;
  const gid = up ? "mini-up" : "mini-down";

  if (!candles.length) return <div className="mini-empty muted">no data</div>;

  return (
    <ResponsiveContainer width="100%" height={72}>
      <AreaChart data={candles} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="linear" dataKey="close" stroke={color} fill={`url(#${gid})`} strokeWidth={1.5} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
