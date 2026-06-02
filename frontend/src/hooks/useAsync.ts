import { useEffect, useState } from "react";

export interface AsyncState<T> {
  loading: boolean;
  data?: T;
  error?: string;
}

/** Run an async function whenever `deps` change, with cancellation on unmount/change. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });
    fn()
      .then((data) => {
        if (!cancelled) setState({ loading: false, data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ loading: false, error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
