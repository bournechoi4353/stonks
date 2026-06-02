import type { Recommendation } from "../api/client";
import { fmtDate } from "../format";

const ACTION_CLASS: Record<string, string> = { Buy: "act-buy", Sell: "act-sell", Hold: "act-hold" };

export type RecStatus = "idle" | "loading" | "done" | "error";

interface Props {
  status: RecStatus;
  rec?: Recommendation;
  error?: string;
  onRun: (refresh: boolean) => void;
}

export function RecommendationCard({ status, rec, error, onRun }: Props) {
  return (
    <div className="card rec-card">
      <div className="rec-head">
        <h3>AI recommendation</h3>
        {status === "done" ? (
          <button className="ghost" onClick={() => onRun(true)}>↻ Refresh</button>
        ) : status === "loading" ? (
          <button className="ghost" disabled>…</button>
        ) : (
          <button onClick={() => onRun(false)}>{status === "error" ? "Retry" : "Get recommendation"}</button>
        )}
      </div>

      {status === "idle" && (
        <p className="muted">
          On-demand to save your Claude usage. Click <strong>Get recommendation</strong> for a Buy/Sell/Hold call with
          full reasoning (Claude Opus 4.8). Results are cached for 30 min, so re-opening this stock won't cost more.
        </p>
      )}
      {status === "loading" && <p className="muted">Analyzing news + signals with Claude Opus 4.8… (can take ~1 min)</p>}
      {status === "error" && <p className="status-error">{error}</p>}

      {status === "done" && rec && (
        <>
          <div className="rec-top">
            <span className={`action ${ACTION_CLASS[rec.action] ?? "act-hold"}`}>{rec.action}</span>
            <Conviction n={rec.conviction} />
            <span className="chip">{rec.time_horizon}-term</span>
            <span className={`chip sent-${rec.news_sentiment}`}>news: {rec.news_sentiment}</span>
          </div>

          <p className="rec-summary">{rec.summary}</p>

          <h4>Why</h4>
          <ul className="reasons">
            {rec.reasoning.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>

          <h4>Risks</h4>
          <ul className="risks">
            {rec.risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>

          <p className="muted rec-foot">
            {rec.model} · {fmtDate(rec.generated_at)} · {rec.disclaimer}
          </p>
        </>
      )}
    </div>
  );
}

function Conviction({ n }: { n: number }) {
  return (
    <span className="conviction" title={`Conviction ${n}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? "dot on" : "dot"} />
      ))}
    </span>
  );
}
