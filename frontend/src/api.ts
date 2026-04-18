const TOKEN_KEY = "stockpro_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(
  path: string,
  opts: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers = new Headers(opts.headers);
  if (opts.body !== undefined && !(opts.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const auth = opts.auth !== false;
  if (auth) {
    const t = getToken();
    if (t) headers.set("Authorization", `Bearer ${t}`);
  }
  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type");
  if (!ct?.includes("application/json")) return undefined as T;
  return (await res.json()) as T;
}
