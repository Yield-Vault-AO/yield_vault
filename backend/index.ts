import { Hono } from "hono";
import { cors } from "hono/cors";
import { registerPoolsRoute } from "./src/routes/pools.ts";
import { warmPoolsCache } from "./src/pools.ts";
import { WARM_INTERVAL_MS } from "./src/config.ts";
import { closeCache } from "./src/cache.ts";

const app = new Hono();

app.use(
  cors({
    origin: "*",
  })
);

app.get("/", (c) => {
  return c.text("Holla!");
});
registerPoolsRoute(app);

app.get("/*", (c) => {
  return c.text("Holla!");
});
const port = Number(Bun.env.PORT || 3000);
Bun.serve({ port, fetch: app.fetch });
console.log(`listening on http://localhost:${port}`);

// Schedule background warming to keep the cache hot
let warmInterval: any | null = null;
let warmInitTimeout: any | null = null;
warmInterval = setInterval(() => {
  // Fire-and-forget background warm
  warmPoolsCache().catch(() => {});
}, WARM_INTERVAL_MS);
(warmInterval as any)?.unref?.();
// Initial warm attempt shortly after server starts
warmInitTimeout = setTimeout(() => {
  warmPoolsCache().catch(() => {});
}, 1000);
(warmInitTimeout as any)?.unref?.();

// Graceful shutdown: clear timers and close Redis
const shutdown = async () => {
  try {
    if (warmInterval) clearInterval(warmInterval);
    if (warmInitTimeout) clearTimeout(warmInitTimeout);
  } catch {}
  try {
    await closeCache();
  } catch {}
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
