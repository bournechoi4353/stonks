import type { SignalSheet } from "../api/client";

export function SignalList({ sheet }: { sheet: SignalSheet }) {
  return (
    <div className="card">
      <div className="sig-head">
        <h3>Quant signals</h3>
        <span className={`badge bias-${sheet.bias}`}>
          {sheet.bias} · {sheet.score.toFixed(2)}
        </span>
      </div>
      <p className="muted">
        {sheet.bullish_count} bullish · {sheet.bearish_count} bearish · {sheet.neutral_count} neutral
      </p>
      <ul className="sig-list">
        {sheet.signals.map((s) => (
          <li key={s.name} className={`sig sig-${s.signal}`}>
            <span className="sig-dot" />
            <div className="sig-body">
              <span className="sig-name">{s.name}</span>
              <span className="sig-detail">{s.detail}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
