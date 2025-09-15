## Backend

This Bun + Hono service exposes a `/pools` endpoint that proxies an upstream source of AO pools and augments them with LiquidOps supply pools. Results are normalized and cached for performance. Caching is Redis-backed when `REDIS_URL` is provided, with an in-memory fallback if Redis is unavailable.

### Routes

- `GET /pools`
  - Proxies to `SOURCE_ROUTE` with `HEADERS_JSON` and forwards the query string.
  - Augments the response with computed LiquidOps pools (one per supported token) using the `liquidops` SDK.
  - Normalization includes an explicit `apy_pct` field for APR/APY and an `external_url` pointing to the LiquidOps page (e.g. `https://liquidops.io/USDA`).
  - Returns a combined array of pools.

### Caching

- Upstream + LiquidOps combined pools are cached for 1 hour (TTL = 3,600,000 ms).
- LiquidOps APRs per token are cached independently with the same TTL to avoid repeated APR computations within the cache window.
- If `REDIS_URL` is set, both caches are stored in Redis (keys: `pools_cache_v1`, `apr:<TICKER>`); otherwise, the service falls back to in-memory storage.

### Environment Variables

Create a `.env` file in this directory with the following variables:

- `SOURCE_ROUTE`: Upstream pools URL. Example: `https://your-upstream.example.com/pools`
- `HEADERS_JSON`: JSON object string of headers to forward upstream. Example: `{"Authorization":"Bearer ..."}`
- `PORT` (optional): Port to serve on. Defaults to `3000`.
- `LIQUIDOPS_WALLET_JWK` (optional): JSON string of a JWK wallet. If present, used to create a signer for the `liquidops` SDK; if omitted, the client runs in read-only mode where possible.
- `REDIS_URL` (optional): Redis connection string. Example: `redis://localhost:6379` or cloud URLs like `rediss://:<password>@<host>:<port>`. When set, the service caches pools/APR in Redis.

### Local development

Install dependencies and build the server bundle:

```sh
# from repo root
bun install --cwd backend
bun run --cwd backend build

# run in watch/dev mode
bun run --cwd backend dev

# or run the built server
bun run --cwd backend start
```

To run with Redis locally (optional), you can export an environment variable or put it into `backend/.env`:

```sh
export REDIS_URL=redis://127.0.0.1:6379
bun run --cwd backend dev
```

If Redis is not reachable, the service will log a warning and continue using in-memory cache.

### Notes

- If the upstream fetch fails, the service will still attempt to serve LiquidOps pools. If both are unavailable, it returns an error.
- All LiquidOps pools are marked as `amm_status: "verified"` and include `protocol: "LiquidOps"`.
