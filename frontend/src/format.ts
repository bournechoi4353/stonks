// Small display formatters. All None-safe.

export const fmtPrice = (v?: number | null, currency?: string | null): string => {
  if (v == null) return "—";
  const prefix = currency === "USD" || currency == null ? "$" : `${currency} `;
  return `${prefix}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const fmtPct = (v?: number | null): string =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;

export const fmtNum = (v?: number | null): string => (v == null ? "—" : v.toLocaleString());

export const fmtMarketCap = (v?: number | null): string => {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(0)}`;
};

export const fmtDate = (s?: string | null): string => {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? String(s)
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export const fmtTime = (s?: string | null): string => {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? String(s) : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

export const fmtDateTime = (s?: string | null): string => {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? String(s)
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};
