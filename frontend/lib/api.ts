/**
 * Central API client config.
 *
 * The backend runs on :3001 by default. Override with NEXT_PUBLIC_API_URL
 * (e.g. when deploying) — it should point at the `/api` root.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:3001/api";

function url(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parse<T>(res: Response, path: string): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: string };
      detail = body?.error ? ` — ${body.error}` : "";
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`Request failed (${res.status}) for ${path}${detail}`);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(url(path), { cache: "no-store" });
  return parse<T>(res, path);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(url(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return parse<T>(res, path);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(url(path), { method: "DELETE", cache: "no-store" });
  return parse<T>(res, path);
}
