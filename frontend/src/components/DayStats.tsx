import type { Quote } from "../api/client";
import { fmtNum, fmtPct, fmtPrice } from "../format";

export function DayStats({ quote }: { quote: Quote }) {
  const up = (quote.change_percent ?? 0) >= 0;
  return (
    <div className="card daystats">
      <div className="ds-head">
        <h3>Today</h3>
        <span className={up ? "up" : "down"}>{fmtPct(quote.change_percent)}</span>
      </div>
      <div className="ds-grid">
        <Stat k="Open" v={fmtPrice(quote.open, quote.currency)} />
        <Stat k="High" v={fmtPrice(quote.day_high, quote.currency)} />
        <Stat k="Low" v={fmtPrice(quote.day_low, quote.currency)} />
        <Stat k="Last" v={fmtPrice(quote.price, quote.currency)} />
        <Stat k="Prev close" v={fmtPrice(quote.previous_close, quote.currency)} />
        <Stat k="Volume" v={fmtNum(quote.volume)} />
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="ds-stat">
      <span className="muted">{k}</span>
      <span>{v}</span>
    </div>
  );
}
