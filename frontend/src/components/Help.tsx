import type { ReactNode } from "react";

function Term({ t, children }: { t: string; children: ReactNode }) {
  return (
    <div className="gloss">
      <div className="gloss-term">{t}</div>
      <div className="gloss-def">{children}</div>
    </div>
  );
}

export function Help() {
  return (
    <div className="help">
      <h2>How to read Stonks</h2>
      <p className="muted">
        Stonks looks at a stock three ways and combines them: the <strong>price charts</strong> (what it has done),
        the <strong>quant signals</strong> (math from that price/volume history), and an <strong>AI</strong> that reads
        those signals plus recent news to write a Buy/Sell/Hold call. Everything except the AI card is plain math — no
        AI usage. <strong>None of this is financial advice.</strong>
      </p>

      <div className="help-grid">
      <div className="card">
        <h3>The three views</h3>
        <Term t="Stock">One stock in depth: chart, today's numbers, AI recommendation, past calls, signals, fundamentals, news.</Term>
        <Term t="Grid">Every watchlist stock as a small chart tile (1/2/3 columns). Click a tile to open its full view.</Term>
        <Term t="Compare">Overlay several stocks' % change on one chart so different-priced stocks line up. Toggle symbols with the colored chips.</Term>
      </div>

      <div className="card">
        <h3>Reading the price chart</h3>
        <Term t="Period tabs">1D / 5D are intraday (bars within the day); 1M / 6M / 1Y are daily. They set how far back the chart looks.</Term>
        <Term t="Line">Just the closing price over time — green if it ended higher than it started, red if lower.</Term>
        <Term t="Candles">
          Each bar holds 4 numbers for that period. The thick <strong>body</strong> spans the open→close;
          <strong> green</strong> = closed higher than it opened, <strong>red</strong> = closed lower. The thin
          <strong> wicks</strong> reach the high and low touched during that period. Long body = strong move; tiny body
          with long wicks = indecision/volatility.
        </Term>
      </div>

      <div className="card">
        <h3>Indicator panels (Volume / RSI / MACD)</h3>
        <p className="muted">Toggle these under the price chart. They're synced — hover anywhere and all panels highlight the same moment.</p>
        <Term t="Volume">
          Shares traded each period (green/red by up/down). High volume = conviction behind a move; a move on low
          volume is weaker.
        </Term>
        <Term t="RSI (0–100)">
          Relative Strength Index — a momentum gauge over 14 periods. <strong>Above 70 = "overbought"</strong> (risen
          fast, may pull back). <strong>Below 30 = "oversold"</strong> (fallen hard, may bounce). 30–70 = neutral. Note:
          a strong stock can stay overbought for a while — RSI shows stretch, not a guaranteed reversal.
        </Term>
        <Term t="MACD">
          Trend/momentum. The <strong>MACD line</strong> = a fast price-average minus a slow one (EMA 12 − EMA 26); the
          <strong> signal line</strong> smooths it (EMA 9); the <strong>histogram</strong> bars = line − signal. Bars
          above zero (green) = bullish momentum, below zero (red) = bearish; growing bars = momentum accelerating.
        </Term>
      </div>

      <div className="card">
        <h3>Quant signals &amp; the composite score</h3>
        <p className="muted">
          Each signal is marked bullish / bearish / neutral. The <strong>composite score</strong> runs −1 (very bearish)
          to +1 (very bullish); &gt; 0.2 → bullish bias, &lt; −0.2 → bearish, in between → neutral.
        </p>
        <Term t="Moving averages (SMA/EMA)">
          The average closing price over the last N days (EMA weights recent days more). Price above its average = uptrend strength.
        </Term>
        <Term t="Golden / death cross">
          When the 50-day average crosses above the 200-day = <strong>golden cross</strong> (bullish, sustained uptrend);
          crossing below = <strong>death cross</strong> (bearish).
        </Term>
        <Term t="Momentum (20-day ROC)">Percent the stock moved over the last 20 days. &gt; +2% bullish, &lt; −2% bearish.</Term>
        <Term t="Volume trend">Recent 10-day vs 50-day average volume, combined with price direction — rising volume confirming an up-move is bullish.</Term>
        <Term t="52-week range position">Where today's price sits between its 1-year low (0%) and high (100%). Near the high = strength; near the low = weakness.</Term>
      </div>

      <div className="card">
        <h3>The AI recommendation (opt-in)</h3>
        <p className="muted">
          Click <strong>Get recommendation</strong> to spend one Claude Opus 4.8 call. It's cached 30 min (re-opening is
          free); Refresh forces a new call. Browsing everything else costs no AI usage.
        </p>
        <Term t="Action">Buy / Sell / Hold.</Term>
        <Term t="Conviction (1–5)">How strongly the combined evidence supports the call. 1 = weak/mixed, 5 = strong/aligned.</Term>
        <Term t="Time horizon">Whether the thesis is short-term or long-term.</Term>
        <Term t="News sentiment">Positive / negative / mixed / neutral, read from recent headlines.</Term>
        <Term t="Why / Risks">Bullet reasons (each citing a specific signal or news item) and what could make the call wrong.</Term>
      </div>

      <div className="card">
        <h3>Track record</h3>
        <Term t="Past recommendations">Every call made for this stock: price then → price now → % since, with ✓/✗ for whether price moved the way the call implied. New calls show "—" (too early to judge).</Term>
        <Term t="Hit rate">Across all calls: the % of Buy/Sell calls that have so far moved the recommended way (Holds excluded). Only meaningful after many calls and some time passes.</Term>
        <Term t="Avg return">Average % change since each recommendation, across all of them.</Term>
      </div>

      <div className="card">
        <h3>Fundamentals glossary</h3>
        <Term t="Market cap">Share price × shares outstanding — the company's total size.</Term>
        <Term t="P/E ratio">Price ÷ earnings per share — how expensive the stock is vs. its profits. <strong>Trailing</strong> uses last year's actual earnings; <strong>Forward</strong> uses expected earnings. Higher = pricier / higher growth expectations.</Term>
        <Term t="Beta">How much it moves vs. the market. 1.0 = moves with the market; &gt;1 = more volatile; &lt;1 = calmer.</Term>
        <Term t="Dividend yield">Annual dividend as a % of price (income from holding it).</Term>
        <Term t="52-week range">The lowest and highest price over the past year.</Term>
      </div>

      <div className="card">
        <h3>Good to know</h3>
        <Term t="Not advice">A research tool to help you think — not financial advice, and never places trades.</Term>
        <Term t="Descriptive, not predictive">Technical indicators describe past momentum/trend; they don't guarantee what's next, and they often conflict.</Term>
        <Term t="Delayed data">Prices come from Yahoo Finance (free), typically ~15 minutes delayed and occasionally flaky.</Term>
      </div>
      </div>
    </div>
  );
}
