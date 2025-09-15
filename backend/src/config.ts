export const CACHE_TTL_MS = 3600000; // 1 hour
export const WARM_MARGIN_MS = 5 * 60 * 1000; // 5 minutes before expiry
export const WARM_INTERVAL_MS = Math.max(5 * 60 * 1000, CACHE_TTL_MS - WARM_MARGIN_MS);

export const CACHE_TTL_SECONDS = Math.max(1, Math.floor(CACHE_TTL_MS / 1000));
export const POOLS_CACHE_KEY = "pools_cache_v1";
export const aprKey = (ticker: string) => `apr:${ticker}`;
