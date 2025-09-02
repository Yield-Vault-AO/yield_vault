import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

// In-memory cache for pools data
let poolsCache: { data?: unknown; timestamp?: number } = {};
const CACHE_TTL_MS = 3600000; // 1 hour

function parseHeadersConfig(rawValue: string): Record<string, string> {
  let sanitized = rawValue.trim();
  // Strip surrounding quotes if present (some platforms include them)
  if (
    (sanitized.startsWith("'") && sanitized.endsWith("'")) ||
    (sanitized.startsWith('"') && sanitized.endsWith('"'))
  ) {
    sanitized = sanitized.slice(1, -1);
  }

  const attempts: Array<() => unknown> = [
    () => JSON.parse(sanitized),
    () => {
      // Try base64-decoded JSON
      const decoded = typeof atob === "function" ? atob(sanitized) : sanitized;
      return JSON.parse(decoded);
    },
    () => {
      // Try URL-decoded JSON
      const decoded = decodeURIComponent(sanitized);
      return JSON.parse(decoded);
    },
  ];

  for (const attempt of attempts) {
    try {
      const parsed = attempt();
      // If double-encoded, parsed may be a JSON string. Try one more parse.
      if (typeof parsed === "string") {
        try {
          const parsedAgain = JSON.parse(parsed);
          if (
            parsedAgain &&
            typeof parsedAgain === "object" &&
            !Array.isArray(parsedAgain)
          ) {
            const normalized: Record<string, string> = {};
            for (const [k, v] of Object.entries(
              parsedAgain as Record<string, unknown>
            )) {
              if (typeof v === "string") normalized[k] = v;
            }
            return normalized;
          }
        } catch {}
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const normalized: Record<string, string> = {};
        for (const [k, v] of Object.entries(
          parsed as Record<string, unknown>
        )) {
          if (typeof v === "string") normalized[k] = v;
        }
        return normalized;
      }
    } catch {
      // try next strategy
    }
  }

  throw new Error("Invalid HEADERS_JSON format");
}

app.use(
  cors({
    origin: "*",
  })
);

app.get("/", (c: Context) => {
  return c.text("Holla!");
});

app.get("/pools", async (c: Context) => {
  const sourceRoute = Bun.env.SOURCE_ROUTE;
  const headersJson = Bun.env.HEADERS_JSON;

  if (!sourceRoute || !headersJson) {
    console.log("misconfigured env: missing SOURCE_ROUTE or HEADERS_JSON");
    return c.json({ error: "misconfigured" }, 400);
  }
  console.log(typeof headersJson)

  // Check cache
  const now = Date.now();
  if (
    poolsCache.data &&
    poolsCache.timestamp &&
    now - poolsCache.timestamp < CACHE_TTL_MS
  ) {
    return c.json(poolsCache.data);
  }

  let headersObj: Record<string, string>;
  try {
    headersObj = parseHeadersConfig(headersJson);
  } catch {
    console.log("misconfigured env: HEADERS_JSON parse error");
    return c.json({ error: "misconfigured" }, 400);
  }

  const headers = new Headers();
  for (const [k, v] of Object.entries(headersObj)) {
    if (typeof v === "string") headers.set(k, v);
  }

  const incomingUrl = new URL(c.req.url);
  const upstreamUrl = new URL(sourceRoute);
  upstreamUrl.search = incomingUrl.search;

  const resp = await fetch(upstreamUrl.toString(), {
    method: "GET",
    headers,
  });

  if (!resp.ok) {
    return c.json({ error: "upstream error" }, resp.status);
  }

  const data: unknown = await resp.json().catch(() => null);
  if (data == null) {
    const txt = await resp.text();
    try {
      const parsed: unknown = JSON.parse(txt);
      // Cache the parsed data
      poolsCache = { data: parsed, timestamp: now };
      return c.json(parsed as any);
    } catch {
      return c.json({ error: "bad payload" }, 400);
    }
  }

  // Cache the data
  poolsCache = { data, timestamp: now };
  return c.json(data as any);
});

const port = Number(Bun.env.PORT || 3000);
Bun.serve({ port, fetch: app.fetch });
console.log(`listening on http://localhost:${port}`);
