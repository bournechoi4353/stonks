import { useEffect, useState } from "react";
import { api, type HelloResponse } from "./api/client";

type ConnState =
  | { kind: "pending" }
  | { kind: "ok"; data: HelloResponse }
  | { kind: "error"; message: string };

export default function App() {
  const [conn, setConn] = useState<ConnState>({ kind: "pending" });

  useEffect(() => {
    api
      .hello()
      .then((data) => setConn({ kind: "ok", data }))
      .catch((err: unknown) =>
        setConn({ kind: "error", message: err instanceof Error ? err.message : String(err) })
      );
  }, []);

  return (
    <main>
      <h1>📈 Stonks</h1>
      <p className="muted">Personal stock recommender — recommends only, never trades. Not financial advice.</p>

      <div className="card">
        <h2>Backend connection</h2>
        {conn.kind === "pending" && <p className="status-pending">Connecting to backend…</p>}
        {conn.kind === "ok" && (
          <>
            <p className="status-ok">✅ Connected</p>
            <p>{conn.data.message}</p>
            <p className="muted">environment: {conn.data.environment}</p>
          </>
        )}
        {conn.kind === "error" && (
          <>
            <p className="status-error">❌ Could not reach backend</p>
            <p className="muted">{conn.message}</p>
            <p className="muted">Is the backend running on port 8000? (uvicorn app.main:app --reload)</p>
          </>
        )}
      </div>
    </main>
  );
}
