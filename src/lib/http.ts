export function normalizeName(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function parseJsonValue<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

export function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
  etag?: string
): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  if (etag) {
    headers.set("etag", etag);
  }
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function errorResponse(status: number, message: string, detail?: string): Response {
  return jsonResponse({ error: message, detail }, { status });
}

export function unauthorized(): Response {
  return errorResponse(401, "Unauthorized");
}

export function notFound(message = "Not found"): Response {
  return errorResponse(404, message);
}

export function badRequest(message: string): Response {
  return errorResponse(400, message);
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function requireAdmin(request: Request, env: { ADMIN_REFRESH_TOKEN?: string }): Response | null {
  const token = env.ADMIN_REFRESH_TOKEN;
  if (!token) {
    return errorResponse(503, "Admin token not configured");
  }
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${token}`) {
    return unauthorized();
  }
  return null;
}

export function makeEtag(value: string): string {
  return `"${value.replace(/"/g, "")}"`;
}

export function cacheHeaders(maxAge: number, sMaxAge?: number): Record<string, string> {
  const parts = [`public`, `max-age=${maxAge}`];
  if (sMaxAge !== undefined) {
    parts.push(`s-maxage=${sMaxAge}`, "stale-while-revalidate=300", "stale-if-error=86400");
  }
  return { "cache-control": parts.join(", ") };
}

export async function cachedJson(
  request: Request,
  cacheKey: string,
  ttlSeconds: number,
  etag: string,
  produce: () => Promise<unknown>,
  cacheControl?: Record<string, string>
): Promise<Response> {
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        etag,
        ...(cacheControl || cacheHeaders(60, ttlSeconds))
      }
    });
  }

  const cache = caches.default;
  const cacheRequest = new Request(`https://cache.local/${cacheKey}`, { method: "GET" });
  const cached = await cache.match(cacheRequest);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("etag", etag);
    if (cacheControl) {
      for (const [key, value] of Object.entries(cacheControl)) {
        headers.set(key, value);
      }
    }
    return new Response(cached.body, { status: cached.status, headers });
  }

  const body = await produce();
  const response = jsonResponse(body, {
    headers: {
      ...cacheHeaders(60, ttlSeconds),
      ...(cacheControl || {}),
      etag
    }
  });

  await cache.put(cacheRequest, response.clone());
  return response;
}
