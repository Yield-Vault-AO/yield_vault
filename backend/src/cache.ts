import Redis from "ioredis";
import { CACHE_TTL_MS, CACHE_TTL_SECONDS, POOLS_CACHE_KEY, aprKey } from "./config.ts";

// In-memory fallback caches
let poolsCache: { data?: unknown; timestamp?: number } = {};
const liquidOpsAprCache: Record<string, { apr: number; timestamp: number }> = {};

// Optional Redis client
const REDIS_URL = Bun.env.REDIS_URL;
let redis: Redis | null = null;
if (REDIS_URL) {
  try {
    redis = new Redis(REDIS_URL);
    redis.on("error", (e) => console.warn("Redis error:", e));
  } catch (e) {
    console.warn("Redis init failed:", e);
    redis = null;
  }
}

export const isRedisEnabled = (): boolean => !!redis;

// Pools cache helpers
export async function readPoolsCache(): Promise<{ data?: unknown; timestamp?: number } | null> {
  if (redis) {
    try {
      const val = await redis.get(POOLS_CACHE_KEY);
      if (val) return JSON.parse(val);
    } catch (e) {
      console.warn("Redis get pools failed:", e);
    }
  }
  return poolsCache?.data ? poolsCache : null;
}

export async function writePoolsCache(data: any[]): Promise<void> {
  const now = Date.now();
  const payload = JSON.stringify({ data, timestamp: now });
  if (redis) {
    try {
      await redis.set(POOLS_CACHE_KEY, payload, "EX", CACHE_TTL_SECONDS);
    } catch (e) {
      console.warn("Redis set pools failed:", e);
    }
  }
  poolsCache = { data, timestamp: now };
}

// APR cache helpers
export async function readApr(ticker: string): Promise<number | undefined> {
  const now = Date.now();
  if (redis) {
    try {
      const raw = await redis.get(aprKey(ticker));
      if (raw) {
        const parsed: any = JSON.parse(raw);
        if (parsed && typeof parsed.apr === "number") return parsed.apr;
      }
    } catch (e) {
      console.warn("Redis get APR failed:", e);
    }
  }
  const cached = liquidOpsAprCache[ticker];
  if (cached && now - cached.timestamp < CACHE_TTL_MS) return cached.apr;
  return undefined;
}

export async function writeApr(ticker: string, apr: number): Promise<void> {
  const now = Date.now();
  if (redis) {
    try {
      await redis.set(aprKey(ticker), JSON.stringify({ apr, timestamp: now }), "EX", CACHE_TTL_SECONDS);
    } catch (e) {
      console.warn("Redis set APR failed:", e);
    }
  }
  liquidOpsAprCache[ticker] = { apr, timestamp: now };
}

export async function closeCache(): Promise<void> {
  try {
    await redis?.quit();
  } catch {}
}
