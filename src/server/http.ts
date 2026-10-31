/** Tiny helpers shared by the route handlers. */
export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });

/** Reads a JSON body without trusting Content-Length: counts the bytes actually received. */
export async function readJson(request: Request, maxBytes: number): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { ok: false, response: json({ status: "invalid", reason: "The request is too large." }, 413) };
  const text = await request.text();
  if (text.length > maxBytes) return { ok: false, response: json({ status: "invalid", reason: "The request is too large." }, 413) };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, response: json({ status: "invalid", reason: "The request body isn't valid JSON." }, 400) };
  }
}

/** Fixed-window limiter keyed by an arbitrary string. In-memory: resets on restart, per-instance on serverless. */
export function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    hits.set(key, [...recent, now]);
    return true;
  };
}
