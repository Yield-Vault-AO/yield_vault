import { parseHeadersConfig } from "./utils/config.ts";
import { buildLiquidOpsPools } from "./liquidops.ts";
import { writePoolsCache } from "./cache.ts";
import { isRedisEnabled } from "./cache.ts";

export async function fetchAndCombinePools(
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

let isWarmingPools = false;

export async function warmPoolsCache(): Promise<void> {
  if (isWarmingPools) return;

  const sourceRoute = Bun.env.SOURCE_ROUTE;
  const headersJson = Bun.env.HEADERS_JSON;
  if (!sourceRoute || !headersJson) return;

  let headersObj: unknown;
  try {
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
      await writePoolsCache(combined);
      console.log(
        `[warm] Pools cache refreshed in ${Date.now() - started}ms with ${combined.length} items (store=${isRedisEnabled() ? "redis" : "memory"})`
      );
    }
  } catch (e) {
    console.warn("[warm] Failed to refresh pools cache:", e);
  } finally {
    isWarmingPools = false;
  }
}
