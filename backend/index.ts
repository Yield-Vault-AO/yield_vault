import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

// In-memory cache for pools data
let poolsCache: { data?: unknown; timestamp?: number } = {};
const CACHE_TTL_MS = 3600000; // 1 hour

function parseHeadersConfig(rawValue: string): Record<string, string> {
  let value = rawValue.trim();
  // Strip one layer of surrounding quotes if present
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    value = value.slice(1, -1);
  }

  const candidates: string[] = [];
  candidates.push(value);
  // URL-decoded
  try {
    candidates.push(decodeURIComponent(value));
  } catch {}
  // Base64-decoded
  try {
    // atob is available in Bun/DOM
    // @ts-ignore
    const decoded = typeof atob === 'function' ? atob(value) : value;
    candidates.push(decoded);
  } catch {}
  // Replace common escape sequences
  candidates.push(value.replace(/\\\"/g, '"'));
  candidates.push(value.replace(/\\\\/g, '\\'));
  candidates.push(value.replace(/\\\\/g, '\\').replace(/\\\"/g, '"'));

  const normalize = (obj: unknown): Record<string, string> | null => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  };

  const peelStringJson = (text: string): unknown => {
    // Try up to 4 peels in case it's a JSON string of a JSON string...
    let current: unknown = text;
    for (let i = 0; i < 4; i++) {
      if (typeof current !== 'string') return current;
      const parsed = JSON.parse(current);
      if (typeof parsed === 'string') {
        current = parsed;
      } else {
        return parsed;
      }
    }
    return current;
  };

  for (const cand of candidates) {
    try {
      // Direct parse
      const direct = JSON.parse(cand);
      const norm = normalize(direct);
      if (norm) return norm;
    } catch {}
    try {
      // Treat as a JSON string literal and then parse again
      const wrapped = '"' + cand.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
      const asString: string = JSON.parse(wrapped);
      const peeled = peelStringJson(asString);
      const norm = normalize(peeled);
      if (norm) return norm;
    } catch {}
  }

  throw new Error('Invalid HEADERS_JSON format');
}

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
    console.log("misconfigured env: missing SOURCE_ROUTE or HEADERS_JSON");
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
