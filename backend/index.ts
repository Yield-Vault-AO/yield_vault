import { Hono } from "hono";
import { cors } from "hono/cors";
import LiquidOps, { tokens as LO_TOKENS, tokenData as LO_TOKEN_DATA } from "liquidops";
import { createDataItemSigner } from "@permaweb/aoconnect";

const app = new Hono();

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

// In-memory cache for pools data
let poolsCache: { data?: unknown; timestamp?: number } = {};
const CACHE_TTL_MS = 3600000; // 1 hour

// In-memory cache for LiquidOps APRs to avoid recomputation within TTL
const liquidOpsAprCache: Record<string, { apr: number; timestamp: number }> = {};
const WARM_MARGIN_MS = 5 * 60 * 1000; // 5 minutes before expiry
const WARM_INTERVAL_MS = Math.max(5 * 60 * 1000, CACHE_TTL_MS - WARM_MARGIN_MS);
let isWarmingPools = false;

// Initialize LiquidOps client with optional JWK signer from env
let liquidOpsClient: LiquidOps | null = null;
try {
  const jwkStr = Bun.env.LIQUIDOPS_WALLET_JWK;
  const signer = jwkStr ? createDataItemSigner(parseHeadersConfig(jwkStr)) : undefined;
  liquidOpsClient = new LiquidOps(signer as any);
} catch (e) {
  console.warn("LiquidOps init warning (will operate in read-only if possible):", e);
  try {
    liquidOpsClient = new LiquidOps(undefined as any);
  } catch {
    liquidOpsClient = null;
  }
}

async function getLiquidOpsApr(ticker: string): Promise<number> {
  // Use cache
  const now = Date.now();
  const cached = liquidOpsAprCache[ticker];
  if (cached && now - cached.timestamp < CACHE_TTL_MS) return cached.apr;

  if (!liquidOpsClient) throw new Error("LiquidOps client unavailable");
  // Library returns APR; normalize to numeric percent if needed
  const resp: any = await liquidOpsClient.getSupplyAPR({ token: ticker });
  let aprPct = 0;
  if (typeof resp === "number") aprPct = resp;
  else if (resp && typeof resp.apr === "number") aprPct = resp.apr;
  else if (resp && typeof resp.apy === "number") aprPct = resp.apy;
  else aprPct = Number(resp) || 0;

  // Clamp absurd values
  if (!Number.isFinite(aprPct) || aprPct < 0) aprPct = 0;
  if (aprPct > 100000) aprPct = 0; // safety guard

  liquidOpsAprCache[ticker] = { apr: aprPct, timestamp: now };
  return aprPct;
}

async function buildLiquidOpsPools(): Promise<any[]> {
  const out: any[] = [];
  try {
    const entries = Object.entries(LO_TOKENS || {}) as Array<[string, string]>;
    for (const [ticker, processId] of entries) {
      try {
        const apr = await getLiquidOpsApr(ticker);
        const meta: any = (LO_TOKEN_DATA as any)?.[ticker] || {};
        out.push({
          amm_name: `${ticker}`,
          amm_process: processId,
          amm_status: "verified",
          token0: processId,
          token0_ticker: ticker,
          token0_name: meta?.name || ticker,
          token1: undefined,
          token1_ticker: undefined,
          token1_name: undefined,
          pool_fee_bps: 0,
          volume_usd: 0,
          liquidity_usd: 0,
          market_cap: undefined,
          token0_current_price: undefined,
          token1_current_price: undefined,
          apy_pct: apr, // explicit APY/APR percentage override for frontend normalization
          external_url: `https://liquidops.io/${ticker}`,
          protocol: "LiquidOps",
        });
      } catch (e) {
        console.warn(`Failed APR for ${ticker}:`, e);
      }
    }
  } catch (e) {
    console.warn("Failed to enumerate LiquidOps tokens:", e);
  }
  return out;
}

async function fetchAndCombinePools(
  sourceRoute: string,
  headers: Headers,
  search: string
): Promise<any[]> {
  const upstreamUrl = new URL(sourceRoute);
  upstreamUrl.search = search;

  let basePools: any[] = [];
  try {
    const resp = await fetch(upstreamUrl.toString(), {
      method: "GET",
      headers,
    });
    if (resp.ok) {
      const data: unknown = await resp.json().catch(() => null);
      if (Array.isArray(data)) {
        basePools = data as any[];
      } else if (data && typeof data === "object" && (data as any).items) {
        basePools = Array.isArray((data as any).items) ? (data as any).items : [];
      }
    } else {
      console.warn("Upstream pools fetch failed:", resp.status);
    }
  } catch (e) {
    console.warn("Upstream fetch error:", e);
  }

  // Always try to add LiquidOps pools; treat as additive
  let loPools: any[] = [];
  try {
    loPools = await buildLiquidOpsPools();
  } catch (e) {
    console.warn("LiquidOps build error:", e);
  }

  return [...basePools, ...loPools];
}

async function warmPoolsCache(): Promise<void> {
  if (isWarmingPools) return;
  // Verify configuration; if misconfigured, skip warming
  const sourceRoute = Bun.env.SOURCE_ROUTE;
  const headersJson = Bun.env.HEADERS_JSON;
  if (!sourceRoute || !headersJson) return;

  let headersObj: unknown;
  try {
    // headersObj = JSON.parse(headersJson);
    headersObj = parseHeadersConfig(headersJson);
  } catch {
    return;
  }
  if (typeof headersObj !== "object" || headersObj === null || Array.isArray(headersObj)) {
    return;
  }

  const headers = new Headers();
  for (const [k, v] of Object.entries(headersObj as Record<string, unknown>)) {
    if (typeof v === "string") headers.set(k, v);
  }

  isWarmingPools = true;
  const started = Date.now();
  try {
    const combined = await fetchAndCombinePools(sourceRoute, headers, "");
    if (combined.length > 0) {
      poolsCache = { data: combined, timestamp: Date.now() };
      console.log(
        `[warm] Pools cache refreshed in ${Date.now() - started}ms with ${combined.length} items`
      );
    }
  } catch (e) {
    console.warn("[warm] Failed to refresh pools cache:", e);
  } finally {
    isWarmingPools = false;
  }
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
    headersObj = parseHeadersConfig(headersJson);
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
  const combined = await fetchAndCombinePools(sourceRoute, headers, incomingUrl.search);
  if (combined.length === 0) {
    return c.json({ error: "no data available" }, 502);
  }

  // Cache and return combined
  poolsCache = { data: combined, timestamp: now };
  return c.json(combined);
});

app.get("/*", (c) => {
  return c.text("Holla!");
});
const port = Number(Bun.env.PORT || 3000);
Bun.serve({ port, fetch: app.fetch });
console.log(`listening on http://localhost:${port}`);

// Schedule background warming to keep the cache hot
setInterval(() => {
  // Fire-and-forget background warm
  warmPoolsCache().catch(() => {});
}, WARM_INTERVAL_MS);
// Initial warm attempt shortly after server starts
setTimeout(() => {
  warmPoolsCache().catch(() => {});
}, 1000);
