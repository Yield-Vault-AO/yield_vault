/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useState, useEffect } from "react";
// import toast from "react-hot-toast";
import type { ReactNode } from "react";

// Pool interface matching what's used in Dashboard
interface Pool {
  amm_status: string;
  fixed_supply: any;
  amm_discovered_at_ts: any;
  token0_market_cap(token0_market_cap: any): number | undefined;
  token0_price_24h_ago: number | undefined;
  token1_market_cap(token1_market_cap: any): number | undefined;
  token1_price_24h_ago: number | undefined;
  transactions: string;
  amm_name?: string;
  amm_process?: string;
  token0?: string;
  token1?: string;
  token0_ticker?: string;
  token1_ticker?: string;
  token0_name?: string;
  token1_name?: string;
  pool_fee_bps?: number;
  volume_usd?: number;
  liquidity_usd?: number;
  market_cap?: number;
  token0_current_price?: number;
  token1_current_price?: number;
  id?: string;
  // Additional properties used in Strategy component
  nextHarvest?: {
    days?: string | number;
    hours?: string | number;
    minutes?: string | number;
    seconds?: string | number;
  };
  totalRewards?: string | number;
  harvestCount?: string | number;
  walletBalance?: string | number;
}

// Strategy interface for processed pool data - ONLY using real data properties
interface Strategy {
  id: string;
  name: string;
  token_icon: string;
  token_icon2: string;
  verified: string;
  protocol: string;
  protocol_icon: string;
  apy: string;
  apyColor: string;
  risk: "low" | "medium" | "high";
  riskScore: number;
  tvl: string;
  badges: string[];
  points: string;
  isStrategy: boolean;
  // Only include properties that can be derived from real pool data
  volume_usd?: number;
  liquidity_usd?: number;
  market_cap?: number;
  pool_fee_bps?: number;
  token0_ticker?: string;
  token1_ticker?: string;
  token0_name?: string;
  token1_name?: string;
  token0_current_price?: number;
  token1_current_price?: number;
  // Additional properties for UI display
  walletBalance?: string | number;
}

// Context type definition
interface PoolContextType {
  pools: Pool[];
  strategies: Strategy[];
  loading: boolean;
  error: string | null;
  fetchPools: () => Promise<void>;
  getPoolById: (id: string) => Pool | undefined;
  getStrategyById: (id: string) => Strategy | undefined;
}

// Create the context
const PoolContext = createContext<PoolContextType | undefined>(undefined);

// Provider component that wraps the app
export function PoolProvider({ children }: { children: ReactNode }) {
  const [pools, setPools] = useState<Pool[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // const hasShownToastRef = useRef(false);

  // Function to fetch pools from API
  const fetchPools = async () => {
    setLoading(true);
    setError(null);

    try {
      const API_BASE = "http://localhost:3000";
      const response = await fetch(`${API_BASE}/pools`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json().catch(() => null);
      let arr: Pool[] = [];

      if (Array.isArray(data)) {
        arr = data;
      } else if (data?.items && Array.isArray(data.items)) {
        arr = data.items;
      }

      // Only show toast if we actually have new data and haven't shown it before
      // const isNewData = pools.length === 0 && arr.length > 0;

      setPools(arr);

      // Process pools into strategies (this logic will be moved from Dashboard)
      const processedStrategies = processPoolsToStrategies(arr);
      setStrategies(processedStrategies);

      // Show success toast only once to avoid duplicates
      // if (isNewData && !hasShownToastRef.current) {
      //   toast.success(`Successfully loaded ${arr.length} pools and strategies`);
      //   hasShownToastRef.current = true;
      // }
    } catch (err) {
      let errorMessage = "Failed to load pools";

      if (err instanceof Error) {
        if (err.message.includes("Failed to fetch")) {
          errorMessage =
            "Network connection issue. Please check your internet connection and try again.";
        } else if (err.message.includes("HTTP 404")) {
          errorMessage =
            "Pools data not found. The service might be temporarily unavailable.";
        } else if (err.message.includes("HTTP 500")) {
          errorMessage = "Server error. Please try again in a few moments.";
        } else if (err.message.includes("HTTP 403")) {
          errorMessage = "Access denied. Please check your permissions.";
        } else {
          errorMessage = `Unable to load pools: ${err.message}`;
        }
      }

      setError(errorMessage);
      console.error("Error fetching pools:", err);

      // if (!hasShownToastRef.current) {
      //   toast.error(`Failed to load pools: ${errorMessage}`);
      //   hasShownToastRef.current = true;
      // }

      // // Show error toast
      // toast.error(`Failed to load pools: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to process pools into strategies
  const processPoolsToStrategies = (poolData: Pool[]): Strategy[] => {
    return poolData
      .map((pool) => {
        // Calculate APY
        const vol = Number(pool?.volume_usd) || 0;
        const liq = Number(pool?.liquidity_usd) || 0;
        const feeBps = Number(pool?.pool_fee_bps) || 0;
        let apyPct = 0;

        if (liq && feeBps) {
          const feeRate = feeBps / 10000;
          const daily = (vol / liq) * feeRate;
          const annual = daily * 365;
          apyPct = Math.max(0, annual) * 100;
        }

        // Calculate risk (simplified version)
        const risk = calculateRisk(pool);

        // Format values
        const fmtPct = (v: number): string => `${v.toFixed(2)}%`;
        const fmtUSD = (v: number): string => {
          if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}m`;
          if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}k`;
          return `$${v.toFixed(2)}`;
        };

        return {
          id:
            pool.amm_process ||
            `${pool.token0_ticker || ""}-${pool.token1_ticker || ""}`,
          name:
            pool.amm_name ||
            `${pool.token0_ticker || pool.token0_name}/${
              pool.token1_ticker || pool.token1_name
            }`,
          token_icon: "", // Will be set by components that need logos
          token_icon2: "", // Will be set by components that need logos
          verified: "", // Will be set by components
          protocol:
            (pool.amm_name && String(pool.amm_name).split(" ")[0]) || "Botega",
          protocol_icon: "", // Will be set by components
          apy: fmtPct(apyPct),
          apyColor: apyPct >= 0 ? "text-blue-500" : "text-red-500",
          risk: risk.risk,
          riskScore: risk.score,
          tvl: fmtUSD(Number(pool.liquidity_usd) || 0),
          badges: [],
          points: "",
          isStrategy: false,
          // Include all the original pool data properties
          volume_usd: pool.volume_usd,
          liquidity_usd: pool.liquidity_usd,
          market_cap: pool.market_cap,
          pool_fee_bps: pool.pool_fee_bps,
          token0_ticker: pool.token0_ticker,
          token1_ticker: pool.token1_ticker,
          token0_name: pool.token0_name,
          token1_name: pool.token1_name,
          token0_current_price: pool.token0_current_price,
          token1_current_price: pool.token1_current_price,
        };
      })
      .filter((strategy) => {
        const apyNum = Number(strategy.apy.replace("%", ""));
        return apyNum > 0;
      })
      .sort((a, b) => {
        if (a.riskScore !== b.riskScore) return b.riskScore - a.riskScore;
        return Number(b.apy.replace("%", "")) - Number(a.apy.replace("%", ""));
      });
  };

  // Helper function to calculate risk (simplified version)
  const calculateRisk = (
    pool: Pool
  ): { risk: "low" | "medium" | "high"; score: number } => {
    const token0Stable = isStableToken(pool.token0_ticker, pool.token0_name);
    const token1Stable = isStableToken(pool.token1_ticker, pool.token1_name);
    const token0AO = isAOToken(pool.token0_ticker, pool.token0_name);
    const token1AO = isAOToken(pool.token1_ticker, pool.token1_name);
    const token0Game = isGameToken(pool.token0_ticker, pool.token0_name);
    const token1Game = isGameToken(pool.token1_ticker, pool.token1_name);

    if (
      (token0Stable && token1AO) ||
      (token1Stable && token0AO) ||
      token0Game ||
      token1Game ||
      (token0Stable && token1Stable)
    ) {
      return { risk: "low", score: 80 };
    }

    if ((token0Stable || token1Stable) && (token0AO || token1AO)) {
      return { risk: "low", score: 60 };
    }

    if (token0Stable || token1Stable) {
      return { risk: "medium", score: 40 };
    }

    return { risk: "high", score: 20 };
  };

  // Helper functions for token classification
  const isStableToken = (ticker?: string, name?: string): boolean => {
    if (!ticker && !name) return false;
    const tokenStr = `${ticker || ""} ${name || ""}`.toLowerCase();
    return (
      tokenStr.includes("usd") ||
      tokenStr.includes("dai") ||
      tokenStr.includes("usdt") ||
      tokenStr.includes("usdc")
    );
  };

  const isAOToken = (ticker?: string, name?: string): boolean => {
    if (!ticker && !name) return false;
    const tokenStr = `${ticker || ""} ${name || ""}`.toLowerCase();
    return tokenStr.includes("ao") || tokenStr.includes("war");
  };

  const isGameToken = (ticker?: string, name?: string): boolean => {
    if (!ticker && !name) return false;
    const tokenStr = `${ticker || ""} ${name || ""}`.toLowerCase();
    return tokenStr.includes("game") || Boolean(name?.includes("Game"));
  };

  // Helper functions to find pools/strategies by ID
  const getPoolById = (id: string): Pool | undefined => {
    return pools.find(
      (pool) =>
        pool.amm_process === id ||
        pool.id === id ||
        `${pool.token0_ticker || ""}-${pool.token1_ticker || ""}` === id
    );
  };

  const getStrategyById = (id: string): Strategy | undefined => {
    return strategies.find((strategy: { id: string }) => strategy.id === id);
  };

  // Fetch pools when component mounts
  useEffect(() => {
    fetchPools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Value object that will be provided to consumers
  const value: PoolContextType = {
    pools,
    strategies,
    loading,
    error,
    fetchPools,
    getPoolById,
    getStrategyById,
  };

  return <PoolContext.Provider value={value}>{children}</PoolContext.Provider>;
}

// Custom hook to use the pool context
export function usePools() {
  const context = useContext(PoolContext);
  if (context === undefined) {
    throw new Error("usePools must be used within a PoolProvider");
  }
  return context;
}
