import { api } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { fmtPct } from "../format";

// refreshKey bumps whenever a new recommendation is generated so the stats stay current.
export function TrackRecord({ refreshKey }: { refreshKey: number }) {
  const { data } = useAsync(() => api.historySummary(), [refreshKey]);
  if (!data || data.total === 0) return null;

  return (
    <div className="card track">
      <h3>Track record</h3>
      <div className="track-grid">
        <div>
          <span className="muted">Recs</span>
          <span>{data.total}</span>
        </div>
        <div>
          <span className="muted">Hit rate</span>
          <span>{data.hit_rate != null ? `${data.hit_rate}%` : "—"}</span>
        </div>
        <div>
          <span className="muted">Avg return</span>
          <span className={(data.avg_return_pct ?? 0) >= 0 ? "up" : "down"}>
            {data.avg_return_pct != null ? fmtPct(data.avg_return_pct) : "—"}
          </span>
        </div>
      </div>
      <p className="muted track-note">
        Hit rate = % of Buy/Sell calls that have moved the recommended way so far ({data.evaluated} evaluated).
      </p>
    </div>
  );
}
