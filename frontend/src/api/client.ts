// Thin client for the backend API. Requests go to /api/* and are proxied to FastAPI
// in development (see vite.config.ts).

export interface HelloResponse {
  message: string;
  environment: string;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Request to ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export const api = {
  hello: () => getJson<HelloResponse>("/api/hello"),
  health: () => getJson<{ status: string }>("/api/health"),
};
