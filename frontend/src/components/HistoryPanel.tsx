import { api } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { fmtDate, fmtPct, fmtPrice } from "../format";

// refreshKey changes (e.g. the current rec's generated_at) force a refetch so a newly
// generated recommendation shows up immediately.
export function HistoryPanel({ symbol, refreshKey }: { symbol: string; refreshKey?: string }) {
  const { loading, data, error } = useAsync(() => api.recHistory(symbol), [symbol, refreshKey]);

  return (
    <div className="card">
      <h3>Past recommendations</h3>
      {loading && <p className="muted">Loading history…</p>}
      {error && <p className="status-error">{error}</p>}
      {data && data.length === 0 && <p className="muted">No past recommendations recorded for {symbol} yet.</p>}
      {data && data.length > 0 && (
        <table className="hist">
          <thead>
            <tr>
              <th>When</th>
              <th>Call</th>
              <th>Price then</th>
              <th>Now</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            {data.map((h) => (
              <tr key={h.id}>
                <td>
                  {fmtDate(h.generated_at)}
                  <div className="muted">{h.days_ago != null ? `${h.days_ago}d ago` : ""}</div>
                </td>
                <td>
                  <span className={`action-sm ${actionClass(h.action)}`}>{h.action}</span>{" "}
                  <span className="muted">{h.conviction}/5</span>
                </td>
                <td>{fmtPrice(h.price)}</td>
                <td>{fmtPrice(h.current_price)}</td>
                <td className={h.return_pct == null ? "muted" : h.aligned === true ? "up" : h.aligned === false ? "down" : ""}>
                  {h.return_pct != null ? fmtPct(h.return_pct) : "—"}
                  {h.aligned === true ? " ✓" : h.aligned === false ? " ✗" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function actionClass(action: string): string {
  return action === "Buy" ? "act-buy" : action === "Sell" ? "act-sell" : "act-hold";
}
