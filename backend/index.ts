import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

// In-memory cache for pools data
let poolsCache: { data?: unknown; timestamp?: number } = {};
const CACHE_TTL_MS = 3600000; // 1 hour

app.use(
  cors({
    origin: "*",
  })
);

app.get("/", (c) => {
  return c.text("Holla!");
});

app.get("/pools", async (c) => {
  const sourceRoute = Bun.env.SOURCE_ROUTE;
  const headersJson = Bun.env.HEADERS_JSON;

  if (!sourceRoute || !headersJson) {
    console.log("misconfigured: ", sourceRoute, headersJson);
    return c.json({ error: "misconfigured" }, 400);
  }

  // Check cache
  const now = Date.now();
  if (
    poolsCache.data &&
    poolsCache.timestamp &&
    now - poolsCache.timestamp < CACHE_TTL_MS
  ) {
    return c.json(poolsCache.data);
  }

  let headersObj: unknown;
  try {
    headersObj = JSON.parse(headersJson);
  } catch {
    console.log("misconfigured: ", headersJson);
    return c.json({ error: "misconfigured" }, 400);
  }
  if (
    typeof headersObj !== "object" ||
    headersObj === null ||
    Array.isArray(headersObj)
  ) {
    return c.json({ error: "misconfigured" }, 400);
  }

  const headers = new Headers();
  for (const [k, v] of Object.entries(headersObj as Record<string, unknown>)) {
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
    return c.json({ error: "upstream error" }, resp.status as any);
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
