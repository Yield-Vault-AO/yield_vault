"use client";

import {
  useCallback,
  useState,
  // useMemo
} from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";
import verified from "../../public/verified.svg";
import ao_token from "../../public/ao_logo.svg";
import back_btn from "../../public/back.svg";
import DashboardFooter from "./dashboard/dashboard_footer";
import { createDataItemSigner, message, result } from "@permaweb/aoconnect";

import { usePools } from "../contexts/PoolContext";
import { AO_TOKEN } from "../constants/yao_process";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { getTokenInfo, formatTokenBalance } from "../helpers/token";
// import user_circle from "../../public/user-circle.svg";
import {
  getUserAgents,
  spawnAgent,
  type AgentRecord,
  getTokenBalance,
} from "../services/aoService";

interface ArweaveWalletWindow {
  arweaveWallet?: {
    getActiveAddress?: () => Promise<string>;
  };
}

export default function StrategyDetail() {
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const {
    getPoolById,
    getStrategyById,
    // strategies,
    // pools
  } = usePools();

  // Get the specific pool and strategy data based on the ID from URL
  const pool = id ? getPoolById(id) : undefined;
  const strategy = id ? getStrategyById(id) : undefined;

  const [depositAmount, setDepositAmount] = useState("");
  const [depositWithdrawTab, setDepositWithdrawTab] = useState("deposit");
  const [activeTab, setActiveTab] = useState("manage");
  const [isLoading, setIsLoading] = useState(true);
  const [isDeployingAgent, setIsDeployingAgent] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [deployStartDate, setDeployStartDate] = useState<string>("");
  const [deployEndDate, setDeployEndDate] = useState<string>("");
  const [deployRunIndefinitely, setDeployRunIndefinitely] = useState<boolean>(
    false
  );

  // User agent state
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [relevantAgent, setRelevantAgent] = useState<AgentRecord | null>(null);
  const [baseTokenBalance, setBaseTokenBalance] = useState<string>("0");

  // State for token logos
  const [tokenLogos, setTokenLogos] = useState<Record<string, string>>({});
  const [logoLoading, setLogoLoading] = useState<Set<string>>(new Set());

  // Helper function to get token logo with fallback
  const getTokenLogo = useCallback(
    (tokenId?: string): string => {
      if (!tokenId) return ao_token;
      return tokenLogos[tokenId] || ao_token;
    },
    [tokenLogos]
  );

  // Function to fetch token logo
  const fetchTokenLogo = React.useCallback(
    async (tokenId: string) => {
      if (!tokenId || tokenLogos[tokenId] || logoLoading.has(tokenId)) return;

      setLogoLoading((prev) => new Set(prev).add(tokenId));

      try {
        const tokenInfo = await getTokenInfo(tokenId);
        setTokenLogos((prev) => ({
          ...prev,
          [tokenId]: tokenInfo.logo,
        }));
      } catch (error) {
        console.error(`Failed to fetch logo for token ${tokenId}:`, error);
        // Use fallback logo on error
        setTokenLogos((prev) => ({
          ...prev,
          [tokenId]: ao_token,
        }));
      } finally {
        setLogoLoading((prev) => {
          const newSet = new Set(prev);
          newSet.delete(tokenId);
          return newSet;
        });
      }
    },
    [tokenLogos, logoLoading]
  );

  // const fetchedStrategies = useMemo(
  //   () =>
  //     strategies.map((strategy) => {
  //       console.log("strategy in dashboard", strategy);
  //       // Find the corresponding pool to get token IDs for logos

  //       console.log("pools in dashboard XXXXXXXXXXXXXXX", pools);
  //       const pool = pools.find(
  //         (p) =>
  //           p.amm_process === strategy.id ||
  //           `${p.token0_ticker || ""}-${p.token1_ticker || ""}` === strategy.id
  //       );

  //       return {
  //         ...strategy,
  //         token_icon: getTokenLogo(pool?.token0),
  //         token_icon2: getTokenLogo(pool?.token1),
  //         verified: verified,
  //         protocol_icon: user_circle,
  //       };
  //     }),
  //   [strategies, pools, getTokenLogo]
  // );

  // Fetch logos for pool tokens when component mounts
  React.useEffect(() => {
    if (pool) {
      if (pool.token0) fetchTokenLogo(pool.token0);
      if (pool.token1) fetchTokenLogo(pool.token1);
    }
  }, [pool, fetchTokenLogo]);

  // Simulate loading state when component mounts
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000); // Show skeleton for 1 second

    return () => clearTimeout(timer);
  }, []);

  // Fetch connected wallet address once
  React.useEffect(() => {
    const fetchAddress = async () => {
      try {
        const addr = await (window as unknown as ArweaveWalletWindow).arweaveWallet?.getActiveAddress?.();
        if (addr) setUserAddress(addr);
      } catch {
        // ignore; UI will prompt to connect if needed
      }
    };
    fetchAddress();
  }, []);

  // Determine base/out tokens: prefer the special token as base
  const SPECIAL_BASE = "0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc";
  const determineBaseToken = React.useCallback((p: typeof pool): string => {
    if (!p) return AO_TOKEN;
    const t0 = (p.token0 as string) || "";
    const t1 = (p.token1 as string) || "";
    if (t0 === SPECIAL_BASE || t1 === SPECIAL_BASE) return SPECIAL_BASE;
    return t1 || AO_TOKEN;
  }, []);

  const determineTokenOut = (p: typeof pool): string => {
    if (!p) return AO_TOKEN;
    const base = determineBaseToken(p);
    const t0 = (p.token0 as string) || "";
    const t1 = (p.token1 as string) || "";
    return base === t0 ? t1 : t0;
  };

  // Fetch user's agents when we have an address, then find agent for this pool
  React.useEffect(() => {
    const fetchAgents = async () => {
      if (!userAddress) return;
      try {
        setAgentError(null);
        const agents = await getUserAgents(userAddress);

        const poolIdForMatch = pool?.amm_process || id || "";
        const match = agents.find(
          (a) =>
            a.pool_id === poolIdForMatch ||
            a.config?.PoolIdOverride === poolIdForMatch
        );
        setRelevantAgent(match || null);

        // Update base token balance after fetching agents
        const baseToken = determineBaseToken(pool);
        if (baseToken) {
          const bal = await getTokenBalance(baseToken, userAddress);
          const formatted = await formatTokenBalance(baseToken, bal, { maxFractionDigits: 6 });
          setBaseTokenBalance(formatted);
        }
      } catch {
        console.error("Failed to fetch user agents:")
        setAgentError("Unable to load your agents. Connect wallet and retry.");
      }
    };

    fetchAgents();
  }, [userAddress, id, pool, pool?.amm_process, determineBaseToken]);


  const handleDeployAgent = async () => {
    if (!pool) return;
    try {
      setIsDeployingAgent(true);
      setAgentError(null);
      const baseToken = determineBaseToken(pool);
      const tokenOut = determineTokenOut(pool);
      const poolIdForConfig = pool.amm_process || (id as string);

      const now = Math.floor(Date.now() / 1000);
      const startTs = deployStartDate
        ? Math.floor(new Date(deployStartDate).getTime() / 1000)
        : now;
      const endTs = deployRunIndefinitely
        ? Number.MAX_SAFE_INTEGER
        : deployEndDate
        ? Math.floor(new Date(deployEndDate).getTime() / 1000)
        : now + 30 * 24 * 60 * 60;
      await spawnAgent({
        dex: "Botega",
        tokenOut,
        slippage: 2,
        startDate: startTs,
        endDate: endTs,
        runIndefinitely: deployRunIndefinitely,
        conversionPercentage: 50,
        strategyType: "Swap50LP50",
        baseToken,
        poolId: poolIdForConfig,
        poolIdReference: pool.id || poolIdForConfig,
      });

      if (userAddress) {
        const agents = await getUserAgents(userAddress);
        const match = agents.find(
          (a) =>
            a.pool_id === poolIdForConfig ||
            a.config?.PoolIdOverride === poolIdForConfig
        );
        setRelevantAgent(match || null);
      }
    } catch (e: unknown) {
      console.error("Agent deployment failed:", e);
      setAgentError(
        e instanceof Error ? e.message : "Agent deployment failed."
      );
    } finally {
      setIsDeployingAgent(false);
    }
  };

  // integrate deposit and withdraw logic

  const deposit = useMutation({
    mutationKey: ["Transfer"],
    mutationFn: async () => {
      if (!relevantAgent?.process_id) {
        throw new Error("No agent deployed for this pool");
      }

      const baseTokenProcess = determineBaseToken(pool);
      const messageId = await message({
        process: baseTokenProcess,
        tags: [
          { name: "Action", value: "Transfer" },
          { name: "Recipient", value: relevantAgent.process_id },
          { name: "Quantity", value: depositAmount },
        ],
        data: "",
        signer: createDataItemSigner(window.arweaveWallet),
      });

      const messageResult = await result({
        process: baseTokenProcess,
        message: messageId,
      });

      if (messageResult.Messages[0].Data) {
        return JSON.parse(messageResult.Messages[0].Data);
      }

      return undefined;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  // const withdraw = useMutation({
  //   mutationKey: ["Withdraw"],
  //   mutationFn: async () => {
  //     const messageId = await message({
  //       process: VAULT,
  //       tags: [
  //         {
  //           name: "Action",
  //           value: "Withdraw",
  //         },
  //         {
  //           name: "Token-Id",
  //           value: AO_TOKEN,
  //         },
  //         {
  //           name: "Quantity",
  //           value: withdrawAmount,
  //         },
  //       ],
  //       data: "",
  //       signer: createDataItemSigner(window.arweaveWallet),
  //     });

  //     const messageResult = await result({
  //       process: VAULT,
  //       message: messageId,
  //     });

  //     console.log(messageResult);
  //     if (messageResult.Messages[0].Data) {
  //       console.log(messageResult.Messages[0].Data);
  //       return JSON.parse(messageResult.Messages[0].Data);
  //     }

  //     return undefined;
  //   },
  //   onSuccess: () => {
  //     queryClient.invalidateQueries();
  //   },
  // });

  // end integrate deposit and withdraw logic

  // If we have pool data, use it; otherwise show loading/error
  if (!pool || !strategy) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] dark:bg-[#0F1419] flex items-center justify-center">
        <div className="text-center">
          {!pool ? (
            <>
              <h1 className="text-2xl font-bold text-[#565E64] mb-4">
                Pool not found
              </h1>
              <Link to="/dashboard" className="text-blue-500 hover:underline">
                Back to Dashboard
              </Link>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center z-40">
              <div className="flex justify-center py-8 mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#1A2228] dark:border-[#F5FBFF] border-t-transparent"></div>
              </div>
              <h1 className="text-2xl font-bold text-[#565E64] mb-4">
                Loading strategy details...
              </h1>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Calculate real APY from pool data
  const calculateRealAPY = () => {
    const vol = Number(pool.volume_usd) || 0;
    const liq = Number(pool.liquidity_usd) || 0;
    const feeBps = Number(pool.pool_fee_bps) || 0;

    if (!liq || !feeBps) return "0.00%";

    const feeRate = feeBps / 10000;
    const daily = (vol / liq) * feeRate;
    const annual = daily * 365;
    const apyPct = Math.max(0, annual) * 100;

    return `${apyPct.toFixed(2)}%`;
  };

  // Calculate price change percentage
  const calculatePriceChange = (
    currentPrice: string | undefined,
    previousPrice: string | undefined
  ) => {
    if (!currentPrice || !previousPrice)
      return { percentage: "N/A", isPositive: false };

    const current = Number(currentPrice);
    const previous = Number(previousPrice);

    if (previous === 0) return { percentage: "N/A", isPositive: false };

    const change = ((current - previous) / previous) * 100;
    return {
      percentage: `${change.toFixed(2)}%`,
      isPositive: change >= 0,
    };
  };

  // Get token price with proper formatting
  const getTokenPrice = (price: string | undefined, decimals: number = 6) => {
    if (!price) return "$0.00";

    const priceNum = Number(price);
    if (isNaN(priceNum)) return "$0.00";

    return `$${priceNum.toFixed(decimals)}`;
  };

  // Format USD values with proper scaling
  const formatUSD = (value: number | undefined) => {
    if (!value || isNaN(value)) return "$0";

    // Handle very large numbers (billions)
    if (value >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(2)}B`;
    }
    // Handle millions
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    }
    // Handle thousands
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(2)}K`;
    }
    // Handle small values
    if (value >= 1) {
      return `$${value.toFixed(2)}`;
    }
    // Handle very small values
    return `$${value.toFixed(6)}`;
  };

  // Skeleton loader components
  const SkeletonLoader = ({ className = "" }: { className?: string }) => (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
    ></div>
  );

  const TabSkeleton = () => (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-4">
        <SkeletonLoader className="h-8 w-64" />
        <SkeletonLoader className="h-4 w-full" />
        <SkeletonLoader className="h-4 w-3/4" />
        <SkeletonLoader className="h-4 w-1/2" />
      </div>

      {/* Content skeleton */}
      <div className="space-y-4">
        <SkeletonLoader className="h-32 w-full" />
        <SkeletonLoader className="h-24 w-full" />
        <SkeletonLoader className="h-20 w-2/3" />
      </div>
    </div>
  );

  // Function to render tab content based on activeTab
  const renderTabContent = () => {
    // Show skeleton loader while data is loading
    if (isLoading || !pool || !strategy) {
      return <TabSkeleton />;
    }

    switch (activeTab) {
      case "manage":
        return (
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-[#1A2228] dark:text-[#EAEAEA] mb-3 sm:mb-4">
              How it works
            </h3>
            <p className="text-[#565E64] dark:text-[#EAEAEA] text-sm leading-relaxed mb-4 sm:mb-6">
              Deploy your AR into your AO/wAR pool, automatically rebalancing
              positions around the current price to optimize yield and reduce
              the need for manual adjustments. Trading fees and DeFi Spring
              rewards are automatically compounded back into the strategy. In
              return, you receive an ERC-20 token representing your share of the
              strategy.
            </p>

            <div className="bg-[#F3F3F3] dark:bg-[#141C22] p-3 sm:p-4 md:p-5 rounded-xl w-full sm:w-fit">
              <h4 className="font-semibold text-base sm:text-lg text-[#565E64] dark:text-[#EAEAEA] mb-2 sm:mb-3">
                Key points to note:
              </h4>
              <ol className="list-decimal list-inside space-y-2 pl-0 sm:pl-4 text-[#565e64] dark:text-[#EAEAEA] text-sm">
                <li>
                  During withdrawal, you may receive either or both tokens
                  depending on market conditions and prevailing prices.
                </li>
                <li>
                  Sometimes you might see a negative APY - this is usually a big
                  deal. It happens when the market conditions are unfavorable.
                </li>
              </ol>
            </div>
          </div>
        );

      case "details":
        return (
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-[#1A2228] dark:text-[#EAEAEA] mb-3 sm:mb-4 flex items-center">
              <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-3 animate-pulse"></div>
              Strategy Details
            </h3>
            <div className="space-y-6">
              {/* Pool Information Card */}
              <Card className="bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF] dark:from-[#1A1F2E] dark:to-[#2D3748] border border-[#EAEAEA] dark:border-[#4A5568] shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="px-6 py-5">
                  <h4 className="font-semibold text-[#565E64] dark:text-[#EAEAEA] mb-4 flex items-center text-lg">
                    <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mr-3"></div>
                    Pool Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-white/60 dark:bg-[#2D3748]/60 rounded-lg border border-[#E2E8F0] dark:border-[#4A5568] hover:bg-white/80 dark:hover:bg-[#2D3748]/80 transition-colors duration-200">
                        <span className="text-sm text-[#7e868c] font-medium">
                          Token Pair
                        </span>
                        <span className="font-semibold text-[#1A2228] dark:text-[#EAEAEA]">
                          {strategy?.name}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white/60 dark:bg-[#2D3748]/60 rounded-lg border border-[#E2E8F0] dark:border-[#4A5568] hover:bg-white/80 dark:hover:bg-[#2D3748]/80 transition-colors duration-200">
                        <span className="text-sm text-[#7e868c] font-medium">
                          APY
                        </span>
                        <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400">
                          {calculateRealAPY()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white/60 dark:bg-[#2D3748]/60 rounded-lg border border-[#E2E8F0] dark:border-[#4A5568] hover:bg-white/80 dark:hover:bg-[#2D3748]/80 transition-colors duration-200">
                        <span className="text-sm text-[#7e868c] font-medium">
                          Total Value Locked
                        </span>
                        <span className="font-semibold text-[#1A2228] dark:text-[#EAEAEA]">
                          {formatUSD(Number(pool.liquidity_usd))}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-white/60 dark:bg-[#2D3748]/60 rounded-lg border border-[#E2E8F0] dark:border-[#4A5568] hover:bg-white/80 dark:hover:bg-[#2D3748]/80 transition-colors duration-200">
                        <span className="text-sm text-[#7e868c] font-medium">
                          Protocol
                        </span>
                        <span className="font-semibold text-[#1A2228] dark:text-[#EAEAEA]">
                          {strategy?.protocol || "Botega"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white/60 dark:bg-[#2D3748]/60 rounded-lg border border-[#E2E8F0] dark:border-[#4A5568] hover:bg-white/80 dark:hover:bg-[#2D3748]/80 transition-colors duration-200">
                        <span className="text-sm text-[#7e868c] font-medium">
                          Volume (24h)
                        </span>
                        <span className="font-semibold text-[#1A2228] dark:text-[#EAEAEA]">
                          {formatUSD(Number(pool.volume_usd))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white/60 dark:bg-[#2D3748]/60 rounded-lg border border-[#E2E8F0] dark:border-[#4A5568] hover:bg-white/80 dark:hover:bg-[#2D3748]/80 transition-colors duration-200">
                        <span className="text-sm text-[#7e868c] font-medium">
                          Pool Fee
                        </span>
                        <span className="font-semibold text-[#1A2228] dark:text-[#EAEAEA]">
                          {pool.pool_fee_bps
                            ? `${pool.pool_fee_bps / 100}%`
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pool Statistics Card */}
              <Card className="bg-gradient-to-br from-[#F0F4FF] to-[#E6F3FF] dark:from-[#1E293B] dark:to-[#334155] border border-[#C7D2FE] dark:border-[#475569] shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="px-6 py-5">
                  <h4 className="font-semibold text-[#565E64] dark:text-[#EAEAEA] mb-4 flex items-center text-lg">
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full mr-3"></div>
                    Pool Statistics
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-white/60 dark:bg-[#334155]/60 rounded-lg border border-[#E2E8F0] dark:border-[#475569] hover:bg-white/80 dark:hover:bg-[#334155]/80 transition-colors duration-200">
                      <div className="text-sm text-[#7e868c] font-medium mb-1">
                        Transactions
                      </div>
                      <div className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400">
                        {pool.transactions || "0"}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-white/60 dark:bg-[#334155]/60 rounded-lg border border-[#E2E8F0] dark:border-[#475569] hover:bg-white/80 dark:hover:bg-[#334155]/80 transition-colors duration-200">
                      <div className="text-sm text-[#7e868c] font-medium mb-1">
                        Status
                      </div>
                      <div className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 capitalize">
                        {pool.amm_status || "Unknown"}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-white/60 dark:bg-[#334155]/60 rounded-lg border border-[#E2E8F0] dark:border-[#475569] hover:bg-white/80 dark:hover:bg-[#334155]/80 transition-colors duration-200">
                      <div className="text-sm text-[#7e868c] font-medium mb-1">
                        Supply Type
                      </div>
                      <div className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-red-600 dark:from-orange-400 dark:to-red-400">
                        {pool.fixed_supply ? "Fixed" : "Variable"}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-white/60 dark:bg-[#334155]/60 rounded-lg border border-[#E2E8F0] dark:border-[#475569] hover:bg-white/80 dark:hover:bg-[#334155]/80 transition-colors duration-200">
                      <div className="text-sm text-[#7e868c] font-medium mb-1">
                        Discovery
                      </div>
                      <div className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-400 dark:to-blue-400">
                        {pool.amm_discovered_at_ts
                          ? new Date(
                              pool.amm_discovered_at_ts * 1000
                            ).toLocaleDateString()
                          : "Unknown"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Token Details Card */}
              <Card className="bg-gradient-to-br from-[#FFF5F5] to-[#FEF2F2] dark:from-[#2D1B1B] dark:to-[#3D2B2B] border border-[#FECACA] dark:border-[#4A2F2F] shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="px-6 py-5">
                  <h4 className="font-semibold text-[#565E64] dark:text-[#EAEAEA] mb-4 flex items-center text-lg">
                    <div className="w-2 h-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-full mr-3"></div>
                    Token Details
                  </h4>
                  <div className="space-y-4">
                    {/* Token 0 */}
                    <div className="bg-white/60 dark:bg-[#3D2B2B]/60 rounded-lg border border-[#FECACA] dark:border-[#4A2F2F] p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <img
                          src={getTokenLogo(pool.token0)}
                          alt={
                            pool.token0_ticker || pool.token0_name || "Token 0"
                          }
                          className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-[#4A2F2F]"
                        />
                        <div>
                          <h5 className="font-semibold text-[#1A2228] dark:text-[#EAEAEA] text-lg">
                            {pool.token0_ticker || pool.token0_name} (Token 0)
                          </h5>
                          <p className="text-sm text-[#7e868c]">
                            Primary Token
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="text-center p-2 bg-white/40 dark:bg-[#3D2B2B]/40 rounded border border-[#FECACA] dark:border-[#4A2F2F]">
                          <div className="text-xs text-[#7e868c] mb-1">
                            Current Price
                          </div>
                          <div className="font-semibold text-[#1A2228] dark:text-[#EAEAEA]">
                            {getTokenPrice(
                              pool.token0_current_price?.toString(),
                              6
                            )}
                          </div>
                        </div>
                        <div className="text-center p-2 bg-white/40 dark:bg-[#3D2B2B]/40 rounded border border-[#FECACA] dark:border-[#4A2F2F]">
                          <div className="text-xs text-[#7e868c] mb-1">
                            Market Cap
                          </div>
                          <div className="font-semibold text-[#1A2228] dark:text-[#EAEAEA]">
                            {pool.token0_market_cap
                              ? formatUSD(Number(pool.token0_market_cap))
                              : "N/A"}
                          </div>
                        </div>
                        <div className="text-center p-2 bg-white/40 dark:bg-[#3D2B2B]/40 rounded border border-[#FECACA] dark:border-[#4A2F2F]">
                          <div className="text-xs text-[#7e868c] mb-1">
                            24h Change
                          </div>
                          <div
                            className={`font-semibold ${
                              calculatePriceChange(
                                pool.token0_current_price?.toString(),
                                pool.token0_price_24h_ago?.toString()
                              ).percentage !== "N/A"
                                ? calculatePriceChange(
                                    pool.token0_current_price?.toString(),
                                    pool.token0_price_24h_ago?.toString()
                                  ).isPositive
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                                : "text-[#7e868c]"
                            }`}
                          >
                            {
                              calculatePriceChange(
                                pool.token0_current_price?.toString(),
                                pool.token0_price_24h_ago?.toString()
                              ).percentage
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Token 1 */}
                    <div className="bg-white/60 dark:bg-[#3D2B2B]/60 rounded-lg border border-[#FECACA] dark:border-[#4A2F2F] p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <img
                          src={getTokenLogo(pool.token1)}
                          alt={
                            pool.token1_ticker || pool.token1_name || "Token 1"
                          }
                          className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-[#4A2F2F]"
                        />
                        <div>
                          <h5 className="font-semibold text-[#1A2228] dark:text-[#EAEAEA] text-lg">
                            {pool.token1_ticker || pool.token1_name} (Token 1)
                          </h5>
                          <p className="text-sm text-[#7e868c]">
                            Secondary Token
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="text-center p-2 bg-white/40 dark:bg-[#3D2B2B]/40 rounded border border-[#FECACA] dark:border-[#4A2F2F]">
                          <div className="text-xs text-[#7e868c] mb-1">
                            Current Price
                          </div>
                          <div className="font-semibold text-[#1A2228] dark:text-[#EAEAEA]">
                            {getTokenPrice(
                              pool.token1_current_price?.toString(),
                              6
                            )}
                          </div>
                        </div>
                        <div className="text-center p-2 bg-white/40 dark:bg-[#3D2B2B]/40 rounded border border-[#FECACA] dark:border-[#4A2F2F]">
                          <div className="text-xs text-[#7e868c] mb-1">
                            Market Cap
                          </div>
                          <div className="font-semibold text-[#1A2228] dark:text-[#EAEAEA]">
                            {pool.token1_market_cap
                              ? formatUSD(Number(pool.token1_market_cap))
                              : "N/A"}
                          </div>
                        </div>
                        <div className="text-center p-2 bg-white/40 dark:bg-[#3D2B2B]/40 rounded border border-[#FECACA] dark:border-[#4A2F2F]">
                          <div className="text-xs text-[#7e868c] mb-1">
                            24h Change
                          </div>
                          <div
                            className={`font-semibold ${
                              calculatePriceChange(
                                pool.token1_current_price?.toString(),
                                pool.token1_price_24h_ago?.toString()
                              ).percentage !== "N/A"
                                ? calculatePriceChange(
                                    pool.token1_current_price?.toString(),
                                    pool.token1_price_24h_ago?.toString()
                                  ).isPositive
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                                : "text-[#7e868c]"
                            }`}
                          >
                            {
                              calculatePriceChange(
                                pool.token1_current_price?.toString(),
                                pool.token1_price_24h_ago?.toString()
                              ).percentage
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case "faqs":
        return (
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-[#1A2228] dark:text-[#EAEAEA] mb-3 sm:mb-4">
              Frequently Asked Questions
            </h3>
            <div className="space-y-4">
              <div className="bg-[#F3F3F3] dark:bg-[#141C22] p-4 rounded-xl">
                <h4 className="font-semibold text-[#565E64] dark:text-[#EAEAEA] mb-2">
                  What is auto-compounding?
                </h4>
                <p className="text-sm text-[#565E64] dark:text-[#EAEAEA]">
                  Auto-compounding automatically reinvests your earned rewards
                  back into the strategy, maximizing your returns over time.
                </p>
              </div>
              <div className="bg-[#F3F3F3] dark:bg-[#141C22] p-4 rounded-xl">
                <h4 className="font-semibold text-[#565E64] dark:text-[#EAEAEA] mb-2">
                  When can I withdraw?
                </h4>
                <p className="text-sm text-[#565E64] dark:text-[#EAEAEA]">
                  You can withdraw your funds at any time. There are no lock-up
                  periods.
                </p>
              </div>
            </div>
          </div>
        );

      case "transactions":
        return (
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-[#1A2228] dark:text-[#EAEAEA] mb-3 sm:mb-4">
              Transaction History
            </h3>
            <div className="bg-[#F3F3F3] dark:bg-[#141C22] p-4 rounded-xl">
              <p className="text-sm text-[#565E64] dark:text-[#EAEAEA] text-center py-8">
                No transactions found for this strategy.
              </p>
            </div>
          </div>
        );

      case "risks":
        return (
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-[#1A2228] dark:text-[#EAEAEA] mb-3 sm:mb-4">
              Risk Assessment
            </h3>
            <div className="space-y-6">
              <div className="bg-[#F3F3F3] dark:bg-[#141C22] p-6 rounded-xl">
                <h4 className="font-semibold text-[#565E64] dark:text-[#EAEAEA] mb-4">
                  Risk Factors
                </h4>
                <ul className="list-disc list-inside space-y-2 text-sm text-[#565E64] dark:text-[#EAEAEA]">
                  <li>Impermanent loss risk due to price divergence</li>
                  <li>Smart contract risk</li>
                  <li>Liquidity risk during market volatility</li>
                  <li>Protocol governance risks</li>
                </ul>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f7f4] dark:bg-[#0F1419]">
      <div className="md:mx-12 mx-4 px-4 py-8">
        {/* Back Button */}
        <Link
          to="/dashboard"
          className="flex items-center space-x-2 text-[#7e868c] hover:text-[#1a2228] mb-6"
        >
          <img src={back_btn} alt="back btn" />
          <span className="text-sm">GO BACK</span>
        </Link>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Strategy Header */}
            <div>
              <div className="flex items-center ">
                <div className="flex items-center space-x-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center">
                    <img
                      src={getTokenLogo(pool.token0)}
                      alt={pool.token0_ticker || pool.token0_name || "Token 0"}
                      className="rounded-full"
                    />
                  </div>
                  <div className="w-10 h-10 -translate-x-4 rounded-full flex items-center justify-center">
                    <img
                      src={getTokenLogo(pool.token1)}
                      alt={pool.token1_ticker || pool.token1_name || "Token 1"}
                      className=" rounded-full"
                    />
                  </div>
                </div>

                <div>
                  <h1 className="text-2xl font-bold text-[#1a2228] dark:text-[#EAEAEA] flex items-center space-x-4">
                    <span>{strategy?.name}</span>
                    <span className="gradient-card p-1 w-4 h-4 md:w-6 rounded-md md:h-6 flex items-center justify-center">
                      <img src={verified} alt="verified" className="" />
                    </span>
                  </h1>
                </div>
              </div>
              <Badge className="bg-green-100 dark:bg-[#092106] space-x-2.5 text-[#20A20F] dark:text-[#4ED93B] mt-3 py-2 px-2 border-[#9AEE8F] dark:border-[#123A0D]">
                <span>APY</span>
                <span>{calculateRealAPY()}</span>
              </Badge>
            </div>

            {/* Next Harvest */}
            <div className="bg-none border-none">
              <h3 className="text-[#565E64] dark:text-[#EAEAEA] text-xl mb-4">
                Next Harvest Is In:
              </h3>
              <div className="py-1">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="gradient-card rounded-md p-4">
                    <div className="text-2xl font-bold text-[#1a2228] dark:text-[#F5FBFF]">
                      {pool?.nextHarvest?.days || "6"}
                    </div>
                    <div className="text-[#7e868c] text-sm">Days</div>
                  </div>

                  <div className="gradient-card rounded-md p-4">
                    <div className="text-2xl font-bold text-[#1a2228] dark:text-[#F5FBFF]">
                      {pool?.nextHarvest?.hours || "7"}
                    </div>
                    <div className="text-[#7e868c] text-sm">Hours</div>
                  </div>

                  <div className="gradient-card rounded-md p-4">
                    <div className="text-2xl font-bold text-[#1a2228] dark:text-[#F5FBFF]">
                      {pool?.nextHarvest?.minutes || "30"}
                    </div>
                    <div className="text-[#7e868c] text-sm">Min</div>
                  </div>

                  <div className="gradient-card rounded-md p-4">
                    <div className="text-2xl font-bold text-[#1a2228] dark:text-[#F5FBFF]">
                      {pool?.nextHarvest?.seconds || "0"}
                    </div>
                    <div className="text-[#7e868c] text-sm">Sec</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rewards Info */}
            <Card className="bg-[#EDF6F9] border border-[#D6EEF6] dark:bg-[#161E24] dark:border-[#192127]">
              <CardContent className="px-6 py-0">
                <div className="space-y-2">
                  <div className="text-[#25A8CF] text-sm">
                    Total rewards harvested:{" "}
                    <span className="font-semibold">
                      {pool?.totalRewards || "0"}
                    </span>
                  </div>
                  <div className="text-[#25A8CF] text-sm">
                    Total number of times harvested:{" "}
                    <span className="font-semibold">
                      {pool?.harvestCount || "0"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Deposit/Withdraw */}
          <div className="space-y-3">
            <div className="flex space-x-4">
              <Button
                onClick={() => setDepositWithdrawTab("deposit")}
                className={`flex-1 py-7 rounded-tl-2xl rounded-tr-2xl rounded-bl-sm rounded-br-sm ${
                  depositWithdrawTab === "deposit"
                    ? "bg-[#D6EEF6] dark:bg-[#052834] dark:text-[#30CFFF] hover:bg-[#D6EEF6]/60 text-[#25A8CF]"
                    : "bg-transparent text-[#25A8CF]"
                }`}
              >
                Deposit
              </Button>
              <Button
                variant="default"
                className={`flex-1 py-7 rounded-tl-2xl rounded-tr-2xl rounded-bl-sm rounded-br-sm bg-transparent text-[#25A8CF] opacity-50 cursor-not-allowed`}
                disabled
                title="Withdraw is managed on the Agent page"
              >
                Withdraw
              </Button>
            </div>

            <Card className="bg-[#F3F3F3] dark:bg-[#141C22] dark:border-[#083341] border-none md:dark:border-solid ">
              <CardContent className="px-6 py-3">
                {agentError && !relevantAgent && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-600 dark:text-red-400 text-sm">{agentError}</p>
                  </div>
                )}
                {!relevantAgent ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-[#FFF5F5] dark:bg-[#2D1B1B] border border-[#FECACA] dark:border-[#4A2F2F] text-[#565E64] dark:text-[#EAEAEA] text-sm">
                      No agent is deployed for this pool yet. Deploy an agent to enable deposits.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-[#7e868c] dark:text-[#95A0A6]">Start Date</label>
                        <input
                          type="datetime-local"
                          className="w-full rounded-md bg-[#EAEAEA] dark:bg-[#1B2329] text-[#1A2228] dark:text-[#EAEAEA] p-2"
                          value={deployStartDate}
                          onChange={(e) => setDeployStartDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[#7e868c] dark:text-[#95A0A6]">End Date</label>
                        <input
                          type="datetime-local"
                          className="w-full rounded-md bg-[#EAEAEA] dark:bg-[#1B2329] text-[#1A2228] dark:text-[#EAEAEA] p-2 disabled:opacity-50"
                          value={deployEndDate}
                          onChange={(e) => setDeployEndDate(e.target.value)}
                          disabled={deployRunIndefinitely}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id="run-indef"
                          type="checkbox"
                          checked={deployRunIndefinitely}
                          onChange={(e) => setDeployRunIndefinitely(e.target.checked)}
                        />
                        <label htmlFor="run-indef" className="text-xs text-[#7e868c] dark:text-[#95A0A6]">
                          Run indefinitely
                        </label>
                      </div>
                      
                    </div>
                    <Button
                      className="w-full !mt-2 bg-[#D6EEF6] dark:bg-[#052834] hover:bg-[#97c2d1] text-[#25A8CF] dark:text-[#30CFFF] h-12"
                      onClick={handleDeployAgent}
                      disabled={isDeployingAgent || !userAddress}
                    >
                      {isDeployingAgent ? "Deploying..." : "Deploy Agent"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 border border-[#DAD9D9E5] dark:border-[#222A30] p-2 rounded-3xl cursor-pointer">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center">
                          <img
                            src={ao_token}
                            alt="ao token"
                            className=" rounded-full"
                          />
                        </div>
                        <span className="font-medium dark:text-[#EAEAEA]">
                          AO
                        </span>
                        <svg
                          className="w-4 h-4 text-[#7e868c]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                      <div className="text-right">
                        <div className="text-[#7E868C] dark:text-[#95A0A6] text-sm">Wallet Balance</div>
                        <div className="font-medium text-lg text-[#565E64] dark:text-[#EAEAEA]">
                          {baseTokenBalance}
                        </div>
                      </div>
                    </div>

                    <div className="relative flex items-center justify-between space-x-4">
                      <Input
                        type="text"
                        placeholder="$ 0.00"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="text-left text-2xl py-7 text-[#95A0A6] w-full border-none bg-[#EAEAEA] dark:bg-[#1B2329] focus:ring-0"
                      />
                      <div className="">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[#7E868C] gradient-card px-4 py-7"
                          onClick={() => {
                            setDepositAmount(String(strategy?.walletBalance || ""));
                          }}
                        >
                          Max
                        </Button>
                      </div>
                    </div>
                    <div className=" text-[#7e868c] text-xs">≈ 0.00 AR</div>

                    <Button
                      className="w-full !mt-7 bg-[#D6EEF6] dark:bg-[#052834] hover:bg-[#97c2d1] text-[#25A8CF] dark:text-[#30CFFF] h-12"
                      disabled={!depositAmount || !relevantAgent}
                      onClick={() => {
                        deposit.mutateAsync();
                      }}
                    >
                      Deposit
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="mt-8 sm:mt-12">
          <div className="flex flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-6 mt-4 sm:mt-6 md:mt-20 border-b border-[#e6e6e6] dark:border-[#192127]">
            <div className="flex flex-wrap gap-2 sm:gap-4 flex-1">
              {["Manage", "Details", "Risks", "FAQs", "Transactions"].map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab.toLowerCase())}
                    className={`pb-2 text-xs sm:text-sm font-medium p-1 px-2 sm:px-4 rounded-tr-md rounded-tl-md transition-colors ${
                      activeTab === tab.toLowerCase()
                        ? "bg-[#ECECEC] dark:bg-[#161E24] text-[#565E64] dark:text-[#F5FBFF]"
                        : "border border-[#EAEAEA] dark:border-[#192127] text-[#7e868c] hover:text-[#1a2228] dark:hover:text-[#7e868c80]"
                    }`}
                  >
                    {tab}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Tab Content */}
          <div className="space-y-4 sm:space-y-6">
            {renderTabContent()}

            <div className="flex flex-wrap items-center gap-3 sm:gap-6">
              <div className="flex items-center space-x-2 gradient-card p-1.5">
                <span className="text-[#565e64] dark:text-[#95A0A6] text-xs sm:text-sm">
                  Risk:
                </span>
                <span className="text-[#565e64] dark:text-[#95A0A6] text-xs sm:text-sm">
                  Very Low
                </span>
              </div>
              <div className="flex items-center space-x-2 gradient-card p-1.5 sm:p-2">
                <img
                  src={verified}
                  alt="verified icon"
                  className="w-3 h-3 sm:w-4 sm:h-4"
                />
                <span className="text-[#565e64] dark:text-[#95A0A6] text-xs sm:text-sm">
                  Audited
                </span>
              </div>
              <div className="flex items-center space-x-2 gradient-card p-1.5 sm:p-2">
                <svg
                  className="w-3 h-3 sm:w-4 sm:h-4 text-[#565e64] dark:text-[#95A0A6]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="text-[#565e64] dark:text-[#95A0A6] text-xs sm:text-sm">
                  Docs
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <DashboardFooter />
    </div>
  );
}
