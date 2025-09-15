import LiquidOps, { tokens as LO_TOKENS, tokenData as LO_TOKEN_DATA } from "liquidops";
import { createDataItemSigner } from "@permaweb/aoconnect";
import { parseHeadersConfig } from "./utils/config.ts";
import { readApr, writeApr } from "./cache.ts";

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

export async function getLiquidOpsApr(ticker: string): Promise<number> {
  // Try cache first
  const cached = await readApr(ticker);
  if (typeof cached === "number") return cached;

  if (!liquidOpsClient) throw new Error("LiquidOps client unavailable");
  const resp: any = await liquidOpsClient.getSupplyAPR({ token: ticker });
  let aprPct = 0;
  if (typeof resp === "number") aprPct = resp;
  else if (resp && typeof resp.apr === "number") aprPct = resp.apr;
  else if (resp && typeof resp.apy === "number") aprPct = resp.apy;
  else aprPct = Number(resp) || 0;

  if (!Number.isFinite(aprPct) || aprPct < 0) aprPct = 0;
  if (aprPct > 100000) aprPct = 0; // safety guard

  await writeApr(ticker, aprPct);
  return aprPct;
}

export async function buildLiquidOpsPools(): Promise<any[]> {
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
          apy_pct: apr,
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
