import { useState } from "react";

export function SearchBar({ onSubmit }: { onSubmit: (symbol: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="search"
      onSubmit={(e) => {
        e.preventDefault();
        const s = value.trim().toUpperCase();
        if (s) {
          onSubmit(s);
          setValue("");
        }
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search ticker (e.g. AAPL)"
        aria-label="Search ticker"
      />
      <button type="submit">Go</button>
    </form>
  );
}
