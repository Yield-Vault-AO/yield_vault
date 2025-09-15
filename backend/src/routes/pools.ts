import type { Hono } from "hono";
import { CACHE_TTL_MS } from "../config.ts";
import { parseHeadersConfig } from "../utils/config.ts";
import { readPoolsCache, writePoolsCache } from "../cache.ts";
import { fetchAndCombinePools } from "../pools.ts";

export function registerPoolsRoute(app: Hono) {
  app.get("/pools", async (c) => {
    const sourceRoute = Bun.env.SOURCE_ROUTE;
    const headersJson = Bun.env.HEADERS_JSON;

    if (!sourceRoute || !headersJson) {
      console.log("misconfigured: ", sourceRoute, headersJson);
      return c.json({ error: "misconfigured" }, 400);
    }

    // Check cache
    const now = Date.now();
    const cached = await readPoolsCache();
    if (cached && cached.data && cached.timestamp && now - cached.timestamp < CACHE_TTL_MS) {
      return c.json(cached.data as any[]);
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
    await writePoolsCache(combined);
    return c.json(combined);
  });
}
