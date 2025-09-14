## Backend

This Bun + Hono service exposes a `/pools` endpoint that proxies an upstream source of AO pools and augments them with LiquidOps supply pools. Results are normalized and cached in-memory for performance.

### Routes

- `GET /pools`
  - Proxies to `SOURCE_ROUTE` with `HEADERS_JSON` and forwards the query string.
  - Augments the response with computed LiquidOps pools (one per supported token) using the `liquidops` SDK.
  - Normalization includes an explicit `apy_pct` field for APR/APY and an `external_url` pointing to the LiquidOps page (e.g. `https://liquidops.io/USDA`).
  - Returns a combined array of pools.

### Caching

- Upstream + LiquidOps combined pools are cached in memory for 1 hour (TTL = 3,600,000 ms).
- LiquidOps APRs per token are cached independently with the same TTL to avoid repeated APR computations within the cache window.

### Environment Variables

Create a `.env` file in this directory with the following variables:

- `SOURCE_ROUTE`: Upstream pools URL. Example: `https://your-upstream.example.com/pools`
- `HEADERS_JSON`: JSON object string of headers to forward upstream. Example: `{"Authorization":"Bearer ..."}`
- `PORT` (optional): Port to serve on. Defaults to `3000`.
- `LIQUIDOPS_WALLET_JWK` (optional): JSON string of a JWK wallet. If present, used to create a signer for the `liquidops` SDK; if omitted, the client runs in read-only mode where possible.

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

### Notes

- If the upstream fetch fails, the service will still attempt to serve LiquidOps pools. If both are unavailable, it returns an error.
- All LiquidOps pools are marked as `amm_status: "verified"` and include `protocol: "LiquidOps"`.
