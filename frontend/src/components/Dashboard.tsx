"use client";

import { getTokenInfo } from "../helpers/token";
import dashboard_grid from "../../public/graph_main_stra.svg";
import dashboard_grid_dark from "../../public/background_grid_dark.svg";
import yao_text from "../../public/YAO.svg";
import yao_text_white from "../../public/yao_text_white.svg";
import { useTheme } from "../hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import ao_logo from "../../public/ao_logo.svg";
// import stEth from "../../public/stETH 2.svg";
// import dai from "../../public/DAI 1.svg";
import help_circle from "../../public/help-circle.svg";
import filter from "../../public/filter.svg";
import user_circle from "../../public/user-circle.svg";
import verified from "../../public/verified.svg";
import DashboardFooter from "./dashboard/dashboard_footer";
import { useState, useEffect, useMemo, useCallback } from "react";
import { RecommendButton } from "./recommendation";
import { getRandomRecommendationPoolId } from "../services/aoService";
import { usePools } from "../contexts/PoolContext";
import { getUserAgents, type AgentRecord } from "../services/aoService";

// Minimal pool type used by the UI
interface Pool {
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
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("strategies");
  // const [currentPage, setCurrentPage] = useState(1);
  const theme = useTheme();

  // Use global pool state instead of local state
  const {
    pools,
    strategies,
    loading: loadingPools,
    error: poolsError,
  } = usePools();

  // State for agents
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);

  // Random recommendation UI state
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomError, setRandomError] = useState<string | null>(null);
  const [randomSelectedPoolId, setRandomSelectedPoolId] = useState<
    string | null
  >(null);

  // State for token logos
  const [tokenLogos, setTokenLogos] = useState<Record<string, string>>({});
  const [logoLoading, setLogoLoading] = useState<Set<string>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const strategiesPerPage = 15;

  // Function to fetch token logo
  const fetchTokenLogo = useCallback(
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
          [tokenId]: ao_logo,
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

  // Fetch logos for all tokens when pools data is available
  useEffect(() => {
    if (pools.length > 0) {
      const tokenIds = new Set<string>();

      pools.forEach((pool) => {
        if (pool.token0) tokenIds.add(pool.token0);
        if (pool.token1) tokenIds.add(pool.token1);
      });

      tokenIds.forEach((tokenId) => {
        fetchTokenLogo(tokenId);
      });
    }
  }, [pools, fetchTokenLogo]);

  // Helper function to get token logo with fallback
  const getTokenLogo = useCallback(
    (tokenId?: string): string => {
      if (!tokenId) return ao_logo;
      return tokenLogos[tokenId] || ao_logo;
    },
    [tokenLogos]
  );

  // Trigger random recommendation
  const handleRandomRecommend = useCallback(async () => {
    try {
      setRandomError(null);
      setRandomLoading(true);
      setRandomSelectedPoolId(null);

      const poolId = await getRandomRecommendationPoolId();
      setRandomSelectedPoolId(poolId);

      // Reset to first page when showing random recommendation
      setCurrentPage(1);
    } catch (e) {
      console.error("Random recommendation failed", e);
      let errorMessage = "Failed to get random recommendation";

      if (e instanceof Error) {
        if (e.message.includes("Failed to fetch")) {
          errorMessage =
            "Network connection issue. Please check your internet connection and try again.";
        } else if (e.message.includes("No pools available")) {
          errorMessage =
            "No pools are currently available for recommendations.";
        } else {
          errorMessage = `Unable to get recommendation: ${e.message}`;
        }
      }

      setRandomError(errorMessage);
    } finally {
      setRandomLoading(false);
    }
  }, []);

  // Display random error (if any)
  useEffect(() => {
    if (randomError) {
      console.error("Random recommendation error:", randomError);
    }
  }, [randomError]);

  const isStableToken = useMemo(
    () =>
      (ticker?: string, name?: string): boolean => {
        if (!ticker && !name) return false;
        const tokenStr = `${ticker || ""} ${name || ""}`.toLowerCase();
        return (
          tokenStr.includes("usd") ||
          tokenStr.includes("dai") ||
          tokenStr.includes("usdt") ||
          tokenStr.includes("usdc")
        );
      },
    []
  );

  const isAOToken = useMemo(
    () =>
      (ticker?: string, name?: string): boolean => {
        if (!ticker && !name) return false;
        const tokenStr = `${ticker || ""} ${name || ""}`.toLowerCase();
        return tokenStr.includes("ao") || tokenStr.includes("war");
      },
    []
  );

  const isGameToken = useMemo(
    () =>
      (ticker?: string, name?: string): boolean => {
        if (!ticker && !name) return false;
        const tokenStr = `${ticker || ""} ${name || ""}`.toLowerCase();
        return tokenStr.includes("game") || Boolean(name?.includes("Game"));
      },
    []
  );

  const calculateRisk = useMemo(
    () =>
      (pool: Pool): { risk: "low" | "medium" | "high"; score: number } => {
        const token0Stable = isStableToken(
          pool.token0_ticker,
          pool.token0_name
        );
        const token1Stable = isStableToken(
          pool.token1_ticker,
          pool.token1_name
        );
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

        // Default high risk
        return { risk: "high", score: 20 };
      },
    [isStableToken, isAOToken, isGameToken]
  );

  // Fetch agents when agents tab is active
  useEffect(() => {
    if (activeTab !== "agents") return;

    const fetchAgents = async () => {
      setLoadingAgents(true);
      setAgentsError(null);

      try {
        // Get user address from wallet if available
        let userAddress;
        try {
          if (window.arweaveWallet) {
            userAddress = await window.arweaveWallet.getActiveAddress();
          }
        } catch (error) {
          console.log("Could not get wallet address:", error);
        }

        const userAgents = await getUserAgents(userAddress);
        console.log("Fetched user agents:", userAgents);
        setAgents(userAgents);
      } catch (error) {
        console.error("Failed to fetch agents:", error);
        let errorMessage = "Failed to load agents";

        if (error instanceof Error) {
          if (error.message.includes("Failed to fetch")) {
            errorMessage =
              "Network connection issue. Please check your internet connection and try again.";
          } else if (error.message.includes("wallet")) {
            errorMessage = "Please connect your wallet to view your agents.";
          } else {
            errorMessage = `Unable to load agents: ${error.message}`;
          }
        }

        setAgentsError(errorMessage);
      } finally {
        setLoadingAgents(false);
      }
    };

    fetchAgents();
  }, [activeTab]);

  const deriveApyPct = useMemo(
    () =>
      (pool: Pool): number => {
        const vol = Number(pool?.volume_usd) || 0;
        const liq = Number(pool?.liquidity_usd) || 0;
        const feeBps = Number(pool?.pool_fee_bps) || 0;
        if (!liq || !feeBps) return 0;
        const feeRate = feeBps / 10000; // e.g., 25 bps => 0.0025
        const daily = (vol / liq) * feeRate; // daily yield estimate
        const annual = daily * 365;
        return Math.max(0, annual) * 100; // percent
      },
    []
  );

  const fmtPct = useMemo(
    () =>
      (v: number): string =>
        `${v.toFixed(2)}%`,
    []
  );

  const fmtUSD = useMemo(
    () =>
      (v: number): string =>
        v >= 1_000_000
          ? `$${(v / 1_000_000).toFixed(2)}m`
          : v >= 1_000
          ? `$${(v / 1_000).toFixed(2)}k`
          : `$${v.toFixed(2)}`,
    []
  );

  // Function to generate risk bars based on risk score
  const generateRiskBars = useMemo(
    () => (riskScore: number) => {
      const totalBars = 5;
      const filledBars = Math.round((riskScore / 100) * totalBars);
      const bars = [];

      // Determine color based on number of filled bars
      const getBarColor = (isFilled: boolean) => {
        if (!isFilled) return "bg-gray-200";

        if (filledBars === 1) return "bg-red-500";
        if (filledBars === 2) return "bg-yellow-500";
        if (filledBars >= 3) return "bg-green-500";

        return "bg-gray-200";
      };

      for (let i = 0; i < totalBars; i++) {
        const isFilled = i < filledBars;
        bars.push(
          <div
            key={i}
            className={`w-1 h-7 rounded-sm ${getBarColor(isFilled)}`}
          />
        );
      }

      return bars;
    },
    []
  );

  // Use strategies from global state and enhance them with logos
  const fetchedStrategies = useMemo(
    () =>
      strategies.map((strategy) => {
        // console.log("strategy in dashboard", strategy);
        // Find the corresponding pool to get token IDs for logos

        // console.log("pools in dashboard XXXXXXXXXXXXXXX", pools);
        const pool = pools.find(
          (p) =>
            p.amm_process === strategy.id ||
            `${p.token0_ticker || ""}-${p.token1_ticker || ""}` === strategy.id
        );

        return {
          ...strategy,
          token_icon: getTokenLogo(pool?.token0),
          token_icon2: getTokenLogo(pool?.token1),
          verified: verified,
          protocol_icon: user_circle,
        };
      }),
    [strategies, pools, getTokenLogo]
  );

  // Pagination logic
  const totalPages = Math.ceil(fetchedStrategies.length / strategiesPerPage);
  const startIndex = (currentPage - 1) * strategiesPerPage;
  const endIndex = startIndex + strategiesPerPage;
  const currentStrategies = fetchedStrategies.slice(startIndex, endIndex);

  // Store strategies and raw pool data in localStorage for Strategy component
  useEffect(() => {
    if (pools.length > 0) {
      localStorage.setItem(
        "fetchedStrategies",
        JSON.stringify(fetchedStrategies)
      );
      localStorage.setItem("rawPoolsData", JSON.stringify(pools));
      console.log("Stored strategies and pools data in localStorage");
    }
  }, [pools, fetchedStrategies]);

  const dynamicTokenCards = useMemo(() => {
    return pools
      .map((pool) => {
        const apyPct = deriveApyPct(pool);
        const risk = calculateRisk(pool);
        const isGame =
          isGameToken(pool.token0_ticker, pool.token0_name) ||
          isGameToken(pool.token1_ticker, pool.token1_name);

        if (apyPct <= 0) return null;

        return {
          symbol: pool.amm_name?.split(" ")[2],
          logo: getTokenLogo(pool.token0),
          logo2: getTokenLogo(pool.token1),
          value: fmtUSD(Number(pool.token1_current_price || 0)),
          apy: fmtPct(apyPct),
          protocol: pool.amm_name?.split(" ")[0],
          volume: fmtUSD(Number(pool.volume_usd) || 0),
          market_cap: fmtUSD(Number(pool.market_cap) || 0),
          tvl: fmtUSD(Number(pool.liquidity_usd) || 0),
          risk: risk.risk,
          riskScore: risk.score,
          isGame: isGame,
          pool: pool,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Prioritize by risk score first (higher = safer), then game tokens, then APY
        if (a!.riskScore !== b!.riskScore) return b!.riskScore - a!.riskScore;
        if (a!.isGame && !b!.isGame) return -1;
        if (!a!.isGame && b!.isGame) return 1;
        return (
          Number(b!.apy.replace("%", "")) - Number(a!.apy.replace("%", ""))
        );
      })
      .slice(0, 4);
  }, [
    pools,
    deriveApyPct,
    fmtPct,
    fmtUSD,
    calculateRisk,
    isGameToken,
    getTokenLogo,
  ]);

  const displayTokenCards = useMemo(() => {
    return dynamicTokenCards;
  }, [dynamicTokenCards]);

  return (
    <div className="min-h-screen bg-[#f8f7f4] dark:bg-[#0F1419]">
      {/* Hero Section with Grid Background */}
      <section className="relative overflow-hidden mt-5 min-h-[250px]">
        {/* Grid Background */}
        <div className="absolute inset-0 overflow-y-hidden -left-1 -top-[128px]">
          {theme.theme == "light" ? (
            <img
              src={dashboard_grid}
              alt="dashboard_grid"
              className="absolute inset-0 opacity-40 md:opacity-45 dark:md:opacity-10 "
            />
          ) : (
            <img
              src={dashboard_grid_dark}
              alt="dashboard_grid"
              className="absolute inset-0 opacity-40 md:opacity-45 dark:md:opacity-50 "
            />
          )}
        </div>

        <div className="relative z-10 md:mx-12 mx-4 px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-0 items-">
            {/* Left Side - Logo and Tagline */}
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                {/* YAO Logo */}
                <img
                  src={theme.theme === "light" ? yao_text : yao_text_white}
                  alt="yao_text"
                  className="w-[127px] h-[48px] mt-1"
                />

                {/* Tagline */}
                <div className="text-[#95A0A6] text-sm leading-relaxed">
                  Auto-Compound. Auto-Earn. No Stress
                </div>
              </div>
            </div>

            {/* Right Side - Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Value Locked Card */}
              <div className="rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:bg-gradient-to-br dark:from-[#10181D] dark:to-[#121A21] dark:text-[#EAEAEA] backdrop-blur-md text-[#1A2228] dark:backdrop-blur-lg flex flex-col items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg p-4 min-h-[120px]">
                <p className="text-[#565E64] dark:text-[#95A0A6] text-xs mb-2 text-center font-medium">
                  Total Value Locked (TVL)
                </p>
                <p className="text-[#1A2228] dark:text-[#EAEAEA] text-2xl md:text-3xl font-bold">
                  $77.40k+
                </p>
              </div>

              {/* Your Holdings / Total Rewards Card */}
              <div className="rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:bg-gradient-to-br dark:from-[#10181D] dark:to-[#121A21] dark:text-[#EAEAEA] backdrop-blur-md text-[#1A2228] dark:backdrop-blur-lg flex flex-col items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg p-4 min-h-[120px]">
                <p className="text-[#565E64] dark:text-[#95A0A6] text-xs mb-2 text-center font-medium">
                  Your Holdings
                </p>
                <p className="text-[#1A2228] dark:text-[#EAEAEA] text-2xl md:text-3xl font-bold">
                  $0
                </p>
              </div>

              <div className="rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:bg-gradient-to-br dark:from-[#10181D] dark:to-[#121A21] dark:text-[#EAEAEA] backdrop-blur-md text-[#1A2228] dark:backdrop-blur-lg flex flex-col items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg p-4 min-h-[120px]">
                <p className="text-[#565E64] dark:text-[#95A0A6] text-xs mb-2 text-center font-medium">
                  Your Referral Link (i)
                </p>
                <p className="text-[#1A2228] dark:text-[#EAEAEA]  text-2xl md:text-3xl font-bold">
                  –
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-4 sm:mx-6 md:mx-12 px-2 sm:px-4 md:px-6 pb-8">
        <div className="flex flex-col md:flex-row justify-between space-x-4 sm:space-x-6 md:space-x-8 mb-4 sm:mb-6 border-b dark:border-[#20282E] border-[#EAEAEA]">
          <div className="flex items-center gap-2 space-x-2">
            <button
              onClick={() => setActiveTab("strategies")}
              className={`pb-2 px-1 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
                activeTab === "strategies"
                  ? "border-[#1fadd8] text-[#1A2228] dark:text-[#F5FBFF]"
                  : "border-transparent text-[#7e868c] hover:text-[#a4a8ab]"
              }`}
            >
              Strategies
            </button>
            <button
              onClick={() => setActiveTab("find-yields")}
              className={`pb-2 px-1 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
                activeTab === "find-yields"
                  ? "border-[#1fadd8] text-[#1A2228] dark:text-[#F5FBFF]"
                  : "border-transparent text-[#7e868c] hover:text-[#a4a8ab]"
              }`}
            >
              Find Yields
            </button>
            <button
              onClick={() => setActiveTab("agents")}
              className={`pb-2 px-1 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
                activeTab === "agents"
                  ? "border-[#1fadd8] text-[#1A2228] dark:text-[#F5FBFF]"
                  : "border-transparent text-[#7e868c] hover:text-[#a4a8ab]"
              }`}
            >
              My Agents
            </button>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-2  mb-1 mt-5 md:mt-0">
            <RecommendButton />
            <Button
              onClick={handleRandomRecommend}
              disabled={randomLoading}
              className="bg-[#1A2228] hover:bg-[#10161b] dark:bg-[#F5FBFF] text-[#eef2f5] dark:text-[#1A2228] dark:hover:bg-[#e7eef5] animate-bounce transition-all duration-200 h-10 md:h-12 px-6 w-full md:w-auto"
            >
              {randomLoading ? (
                <div className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white dark:border-[#1A2228]"></span>
                  Random Recommend
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5"
                  >
                    <path d="M13.5 3a1.5 1.5 0 0 0-3 0v1.05a7.5 7.5 0 1 0 3 0V3Zm-1.5 6.75a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3a.75.75 0 0 1 .75-.75Zm0 7.5a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Z" />
                  </svg>
                  Random Recommend
                </div>
              )}
            </Button>
          </div>
        </div>

        {/* Token Cards - Only show for strategies and find-yields tabs */}
        {(activeTab === "strategies" || activeTab === "find-yields") && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {displayTokenCards.map((token, index) => (
              <Card
                key={index}
                className="bg-white/80 gradient-card w-full border-none"
              >
                <CardContent className="p-3 sm:p-4 md:p-5 flex flex-col items-center py-0">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-2">
                      <div className="w-10 h-10 bg-[#1a2228] rounded-full flex items-center justify-center">
                        <div className="flex">
                          <img
                            src={token?.logo}
                            alt={token?.symbol}
                            className="w-5 h-5 rounded-full"
                          />
                          <img
                            src={token?.logo2}
                            alt={token?.symbol}
                            className="w-5 h-5 rounded-full -translate-x-2"
                          />
                        </div>
                      </div>

                      <div className="text-[#1a2228] dark:text-[#FEFEFD] flex flex-col items-center font-semibold">
                        <span className="text-base">
                          {/* {token?.amount} */} {token?.symbol}
                        </span>
                        <span className="text-[#7e868c] text-sm">
                          {token?.value}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-end font-semibold">
                      <div className="text-[#1a2228] dark:text-[#FEFEFD] text-base">
                        {token?.tvl}
                      </div>
                      <div className="text-[#7e868c] text-sm">
                        {token?.market_cap}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full mt-3 sm:mt-4">
                    <div className="text-[#7e868c] text-xs font-semibold">
                      {token?.protocol}
                    </div>
                    <div className="text-[#7e868c] text-xs font-semibold">
                      <span className="text-[#5CAB28]">{token?.apy}</span> APY
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Strategies and Find Yields Content */}
        {(activeTab === "strategies" || activeTab === "find-yields") && (
          <>
            {/* Filter Tabs for Find Yields */}
            {activeTab === "find-yields" && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-3 sm:space-y-0">
                <div className="flex flex-wrap gap-2 sm:gap-4">
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-[#ECECEC] dark:bg-[#161E24] text-[#565E64] hover:bg-[#ececec95] dark:hover:bg-[#161e2484] text-xs sm:text-sm"
                  >
                    All
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="border border-[#EAEAEA] dark:border-[#192127] text-[#565E64] hover:bg-[#ececec95] dark:hover:bg-[#161e2484] text-xs sm:text-sm"
                  >
                    Dexi
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="border border-[#EAEAEA] dark:border-[#192127] text-[#565E64] hover:bg-[#ececec95] dark:hover:bg-[#161e2484] text-xs sm:text-sm"
                  >
                    Botega
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="border border-[#EAEAEA] dark:border-[#192127] text-[#565E64] hover:bg-[#ececec95] dark:hover:bg-[#161e2484] text-xs sm:text-sm"
                  >
                    Permaswap
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="border border-[#EAEAEA] dark:border-[#192127] text-[#565E64] hover:bg-[#ececec95] dark:hover:bg-[#161e2484] text-xs sm:text-sm"
                  >
                    Liquid Ops
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[#565E64] dark:text-[#95A0A6] hover:bg-none border border-[#EAEAEA] dark:border-[#192127] text-xs sm:text-sm"
                >
                  <img
                    src={filter}
                    alt="filter"
                    className="w-3 h-3 sm:w-4 sm:h-4"
                  />
                  <span className="ml-1">Filter</span>
                </Button>
              </div>
            )}

            {/* Desktop Table View */}
            <div className="hidden lg:block">
              <Card className="bg-none border-none px-0">
                <CardContent className="p-0">
                  <div className="px-4 py-2 text-sm">
                    {loadingPools && (
                      <span className="text-[#7e868c]">Loading pools…</span>
                    )}
                    {!loadingPools && poolsError && (
                      <div className="flex items-center justify-center py-8">
                        <div className="text-center">
                          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                            <svg
                              className="w-8 h-8 text-red-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                              />
                            </svg>
                          </div>
                          <h3 className="text-lg font-semibold text-[#1A2228] dark:text-[#EAEAEA] mb-2">
                            Unable to Load Data
                          </h3>
                          <p className="text-[#565E64] dark:text-[#95A0A6] text-sm mb-4 max-w-md">
                            {poolsError}
                          </p>
                          <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-[#1fadd8] text-white rounded-lg hover:bg-[#1a8bb8] transition-colors"
                          >
                            Try Again
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Table Header */}
                  <div className="grid grid-cols-7 bg-[#F0F0F0] dark:bg-[#182026] rounded-tr-xl rounded-tl-xl gap-4 p-4 text-[#7e868c] text-sm font-medium">
                    <div className="col-span-3">
                      {activeTab === "strategies"
                        ? "STRATEGY NAME"
                        : "POOL NAME"}
                    </div>
                    <div className="text-center">APY</div>
                    <div className="text-center">RISK</div>
                    <div className="text-center">TVL</div>
                    <div className="text-center">INFO</div>
                  </div>

                  {/* Strategy Rows */}
                  {loadingPools
                    ? Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-7 gap-4 p-4 mb-2 rounded-br-lg rounded-bl-lg bg-[#F3F3F3] dark:bg-[#141C22]"
                        >
                          {/* Strategy Name Column */}
                          <div className="flex space-x-3 col-span-3">
                            <div className="flex">
                              <div className="w-5 h-5 md:w-8 md:h-8 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 animate-pulse"></div>
                              <div className="w-5 h-5 md:w-8 md:h-8 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 animate-pulse -translate-x-2"></div>
                            </div>
                            <div className="flex flex-col space-y-2">
                              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24"></div>
                              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16"></div>
                            </div>
                          </div>

                          {/* APY Column */}
                          <div className="text-center flex items-center justify-center">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-12"></div>
                          </div>

                          {/* Risk Column */}
                          <div className="text-center flex justify-center">
                            <div className="flex space-x-1.5">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <div
                                  key={i}
                                  className="w-1 h-7 bg-gray-200 dark:bg-gray-700 rounded-sm animate-pulse"
                                ></div>
                              ))}
                            </div>
                          </div>

                          {/* TVL Column */}
                          <div className="text-center flex items-center justify-center">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16"></div>
                          </div>

                          {/* Info Column */}
                          <div className="text-center flex justify-center">
                            <div className="w-4 h-4 md:w-10 md:h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                          </div>
                        </div>
                      ))
                    : currentStrategies
                        .filter((s) =>
                          randomSelectedPoolId
                            ? s.id === randomSelectedPoolId
                            : true
                        )
                        .map((strategy, index) => (
                          <Link key={index} to={`/strategy/${strategy.id}`}>
                            <div
                              className={`grid grid-cols-7 gap-4 p-4 mb-2 rounded-br-lg rounded-bl-lg bg-[#F3F3F3] hover:bg-[#f7f7f6] dark:hover:bg-[#20282E] dark:bg-[#141C22] transition-colors cursor-pointer relative`}
                            >
                              {/* {strategy.isStrategy && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-[#141c2298] backdrop-blur-[0.5px] opacity-90 z-10 pointer-events-none"></div>
                  )} */}

                              <div className="flex space-x-3 col-span-3">
                                <div className=" flex">
                                  <span className="w-5 h-5 md:w-8 md:h-8 rounded-2xl bg-gradient-to-br from-white to-[#EAEAEA] dark:bg-gradient-to-br dark:from-[#10181D] dark:to-[#141C22] backdrop-blur-md dark:text-white flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg">
                                    <img
                                      src={strategy.token_icon}
                                      alt={strategy.name}
                                      className=""
                                    />
                                  </span>
                                  <span className="w-5 h-5 md:w-8 md:h-8 rounded-2xl bg-gradient-to-br from-white to-[#EAEAEA] dark:bg-gradient-to-br dark:from-[#10181D] dark:to-[#121A21] backdrop-blur-md dark:text-white flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg -translate-x-2">
                                    <img
                                      src={strategy.token_icon2}
                                      alt={strategy.name}
                                      className=" "
                                    />
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <div className="font-medium text-[#1a2228] dark:text-[#FEFEFD] flex items-center space-x-2">
                                    <span>{strategy.name}</span>
                                    {strategy.badges.map((badge, i) => (
                                      <div className="flex items-center space-x-2">
                                        <span className="w-4 h-4 md:w-8 md:h-6 rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:bg-gradient-to-br dark:from-[#10181D] dark:to-[#121A21] backdrop-blur-md dark:text-white flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg">
                                          <img
                                            src={strategy.verified}
                                            alt={strategy.name}
                                            className=""
                                          />
                                        </span>

                                        <Badge
                                          key={i}
                                          variant="secondary"
                                          className="bg-gradient-to-br from-white to-[#EAEAEA] dark:bg-gradient-to-br dark:from-[#10181D] dark:to-[#121A21] backdrop-blur-md dark:text-white py-1 flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg text-[#10181D] text-xs"
                                        >
                                          {badge}
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>

                                  <div className=" flex items-center space-x-1">
                                    <img
                                      src={strategy.protocol_icon}
                                      alt={strategy.name}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-[#808c7e] text-sm">
                                      {strategy.protocol}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-center space-y-1">
                                {strategy.isStrategy ? (
                                  <div
                                    className={`p-1.5 mx-auto hover:bg-[#e9e9e9] w-4 h-4 md:w-10 md:h-10 text-center rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:bg-gradient-to-br dark:from-[#20282E] dark:to-[#121A21] backdrop-blur-md font-bold dark:text-white transition-all duration-200 hover:scale-105 shadow-lg`}
                                  >
                                    {strategy.apy}
                                  </div>
                                ) : (
                                  <div
                                    className={`font-medium ${strategy.apyColor}`}
                                  >
                                    {strategy.apy}
                                  </div>
                                )}

                                <div className="">
                                  {strategy.isStrategy ? (
                                    <div></div>
                                  ) : (
                                    <div className="text-[#7e868c] text-sm text-center flex items-center justify-center space-x-1">
                                      <span>{strategy.points}</span>

                                      <span>
                                        <img
                                          src={user_circle}
                                          alt={strategy.name}
                                        />
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-center">
                                {strategy.isStrategy ? (
                                  <div className="flex justify-center space-x-2">
                                    <button className="p-1.5 font-bold hover:bg-[#e9e9e9] w-4 h-4 md:w-10 md:h-10 text-center rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:bg-gradient-to-br dark:from-[#20282E] dark:to-[#121a21] backdrop-blur-md dark:text-white transition-all duration-200 hover:scale-105 shadow-lg">
                                      —
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex justify-center">
                                    <div className="flex space-x-1.5">
                                      {generateRiskBars(
                                        strategy.riskScore || 60
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="">
                                {strategy.isStrategy ? (
                                  <div className="p-1.5 font-bold mx-auto hover:bg-[#e9e9e9] w-4 h-4 md:w-10 md:h-10 text-center rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:bg-gradient-to-br dark:from-[#20282E] dark:to-[#121A21] backdrop-blur-md dark:text-white transition-all duration-200 hover:scale-105 shadow-lg">
                                    {strategy.tvl}
                                  </div>
                                ) : (
                                  <div className="text-center font-medium text-[#565E64] ">
                                    {strategy.tvl}
                                  </div>
                                )}
                              </div>

                              <div className="text-center ">
                                <button className="p-1.5 hover:bg-[#e9e9e9] w-10 h-10 text-center rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:bg-gradient-to-br dark:from-[#10181D] dark:to-[#121A21] backdrop-blur-md dark:text-white transition-all duration-200 hover:scale-105 shadow-lg">
                                  <img src={help_circle} alt={strategy.name} />
                                </button>
                              </div>
                            </div>
                          </Link>
                        ))}
                </CardContent>
              </Card>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden space-y-3 sm:space-y-4 relative">
              {currentStrategies
                .filter((s) =>
                  randomSelectedPoolId ? s.id === randomSelectedPoolId : true
                )
                .map((strategy, index) => (
                  <Link key={index} to={`/strategy/${strategy.id}`}>
                    <div className="relative">
                      {strategy.isStrategy && (
                        <div className="absolute inset-0 bg-white/60 dark:bg-[#141c2298] backdrop-blur-[0.5px] opacity-90 z-10 pointer-events-none rounded-lg"></div>
                      )}
                      <Card className="bg-white dark:bg-[#141C22] mb-2 p-2 sm:p-3 border border-gray-200 dark:border-[#20282E] shadow-sm hover:shadow-md transition-all duration-200">
                        <CardContent className="px-3 sm:px-4 py-2 sm:py-3">
                          <div className="relative z-20">
                            {/* Header - Title and Token */}
                            <div className="flex items-center justify-between mb-2 sm:mb-3">
                              <div className="flex items-center space-x-2 sm:space-x-3">
                                <img
                                  src={strategy.token_icon}
                                  alt={strategy.name}
                                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full"
                                />
                                <div>
                                  <h3 className="font-semibold text-[#1a2228] dark:text-[#FEFEFD] text-xs sm:text-sm">
                                    {strategy.name}
                                  </h3>
                                  <p className="text-[#7e868c] text-xs flex items-center space-x-1">
                                    <span>{strategy.protocol}</span>
                                  </p>
                                </div>
                              </div>

                              {/* Verification and Badges */}
                              <div className="flex items-center space-x-1 sm:space-x-2">
                                <img
                                  src={strategy.verified}
                                  alt="verified"
                                  className="w-3 h-3 sm:w-4 sm:h-4"
                                />
                                {strategy.badges.map((badge, i) => (
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="bg-gradient-to-br from-white to-[#EAEAEA] dark:bg-gradient-to-br dark:from-[#10181D] dark:to-[#121A21] backdrop-blur-md dark:text-white shadow-sm text-[#10181D] text-xs px-1 sm:px-2 py-1"
                                  >
                                    {badge === "Hot & New"
                                      ? "Hot & New"
                                      : badge}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            {/* Metrics Row */}
                            <div className="flex items-center justify-between mb-2 sm:mb-3">
                              {/* APY */}
                              <div className="text-center">
                                <p className="text-[#7e868c] text-xs mb-1">
                                  APY
                                </p>
                                <p
                                  className={`font-semibold text-xs sm:text-sm ${strategy.apyColor}`}
                                >
                                  {strategy.apy}
                                </p>
                              </div>

                              {/* Risk */}
                              <div className="text-center">
                                <p className="text-[#7e868c] text-xs mb-1">
                                  RISK
                                </p>
                                <div className="flex space-x-1">
                                  <div className="text-center">
                                    {strategy.isStrategy ? (
                                      <div className="flex justify-center space-x-2">
                                        <button className="p-1.5 font-bold hover:bg-[#e9e9e9] w-4 h-4 md:w-10 md:h-10 text-center rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:bg-gradient-to-br dark:from-[#20282E] dark:to-[#121a21] backdrop-blur-md dark:text-white transition-all duration-200 hover:scale-105 shadow-lg">
                                          —
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex justify-center">
                                        <div className="flex space-x-1.5">
                                          {generateRiskBars(
                                            strategy.riskScore || 60
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* TVL */}
                              <div className="text-center">
                                <p className="text-[#7e868c] text-xs mb-1">
                                  TVL
                                </p>
                                <p className="font-semibold text-[#565E64] text-xs sm:text-sm">
                                  {strategy.tvl}
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </Link>
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center space-x-1 sm:space-x-2 mt-4 sm:mt-6">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-xs sm:text-sm px-3 sm:px-4 py-2 font-medium transition-all duration-200 ${
                    currentPage === 1
                      ? "text-[#95A0A6] dark:text-[#565E64] cursor-not-allowed opacity-50"
                      : "text-[#7E868C] dark:text-[#95A0A6] hover:bg-[#EFEFEFE5] dark:hover:bg-[#161E24] hover:text-[#565E64] dark:hover:text-[#F5FBFF] hover:scale-105"
                  }`}
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                >
                  <svg
                    className="w-3 h-3 sm:w-4 sm:h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  <span className="hidden sm:inline">Prev</span>
                </Button>

                {/* Page Numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  const isActive = currentPage === pageNum;
                  return (
                    <Button
                      key={pageNum}
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className={`text-xs sm:text-sm px-3 sm:px-4 py-2 font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-[#1fadd8] text-white shadow-lg scale-105 border-2 border-[#1a8bb8] hover:bg-[#1a8bb8]"
                          : "text-[#7E868C] dark:text-[#95A0A6] hover:bg-[#EFEFEFE5] dark:hover:bg-[#161E24] hover:text-[#565E64] dark:hover:text-[#F5FBFF]"
                      }`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}

                {totalPages > 5 && (
                  <>
                    <span className="text-[#7e868c] text-xs sm:text-sm">
                      ...
                    </span>
                    <Button
                      variant={currentPage === totalPages ? "default" : "ghost"}
                      size="sm"
                      className={`text-xs sm:text-sm px-3 sm:px-4 py-2 font-medium transition-all duration-200 ${
                        currentPage === totalPages
                          ? "bg-[#1fadd8] text-white shadow-lg scale-105 border-2 border-[#1a8bb8] hover:bg-[#1a8bb8]"
                          : "text-[#7E868C] dark:text-[#95A0A6] hover:bg-[#EFEFEFE5] dark:hover:bg-[#161E24] hover:text-[#565E64] dark:hover:text-[#F5FBFF]"
                      }`}
                      onClick={() => setCurrentPage(totalPages)}
                    >
                      {totalPages}
                    </Button>
                  </>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className={`text-xs sm:text-sm px-3 sm:px-4 py-2 font-medium transition-all duration-200 ${
                    currentPage === totalPages
                      ? " dark:bg-[#565E64] text-[#7E868C] dark:text-[#95A0A6] cursor-not-allowed opacity-50"
                      : "bg-[#EFEFEFE5] dark:bg-[#161E24] text-[#565E64] dark:text-[#95A0A6] hover:bg-[#1fadd8] hover:text-white hover:scale-105 hover:shadow-lg"
                  }`}
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                >
                  <span className="hidden sm:inline">Next</span>
                  <svg
                    className="w-3 h-3 sm:w-4 sm:h-4 ml-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Button>
              </div>
            )}

            {/* Page Info */}
            {totalPages > 1 && (
              <div className="text-center mt-3">
                <div className="inline-flex items-center space-x-2 bg-[#EFEFEFE5] dark:bg-[#161E24] px-4 py-2 rounded-lg">
                  <span className="text-sm text-[#7E868C] dark:text-[#95A0A6]">
                    Page
                  </span>
                  <span className="text-lg font-bold text-[#1fadd8] dark:text-[#30CFFF]">
                    {currentPage}
                  </span>
                  <span className="text-sm text-[#7E868C] dark:text-[#95A0A6]">
                    of {totalPages}
                  </span>
                  <span className="text-[#7E868C] dark:text-[#95A0A6]">•</span>
                  <span className="text-sm text-[#7E868C] dark:text-[#95A0A6]">
                    Showing {currentStrategies.length} of{" "}
                    {fetchedStrategies.length} strategies
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Agents Content */}
        {activeTab === "agents" && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-[#1A2228] dark:text-[#F5FBFF]">
                My Agents
              </h2>
              <div className="text-sm text-[#565E64] dark:text-[#95A0A6]">
                {agents.length} agent{agents.length !== 1 ? "s" : ""} found
              </div>
            </div>

            {loadingAgents && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A2228] dark:border-[#F5FBFF]"></div>
              </div>
            )}

            {agentsError && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#1A2228] dark:text-[#EAEAEA] mb-2">
                  Unable to Load Agents
                </h3>
                <p className="text-[#565E64] dark:text-[#95A0A6] text-sm mb-4 max-w-md">
                  {agentsError}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-[#1fadd8] text-white rounded-lg hover:bg-[#1a8bb8] transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {!loadingAgents && !agentsError && agents.length === 0 && (
              <div className="text-center py-12">
                <div className="text-[#565E64] dark:text-[#95A0A6] mb-4">
                  <svg
                    className="w-16 h-16 mx-auto mb-4 opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-lg font-medium mb-2">No agents found</p>
                  <p className="text-sm">
                    Deploy your first agent using the recommendation system
                  </p>
                </div>
                <RecommendButton className="animate-none" />
              </div>
            )}

            {!loadingAgents && !agentsError && agents.length > 0 && (
              <div className="grid gap-4">
                {agents.map((agent) => (
                  <Link
                    key={agent.process_id}
                    to={`/agent/${agent.process_id}`}
                    className="block"
                  >
                    <Card className="rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:from-[#10181D] dark:to-[#121A21] border border-[#EAEAEA] dark:border-[#192127] hover:scale-105 transition-all duration-200 shadow-lg cursor-pointer">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#4C545A] to-[#060E14] dark:from-[#DAD9D9E5] dark:to-[#F8F7F4] flex items-center justify-center">
                              <svg
                                className="w-6 h-6 text-white dark:text-[#1A2228]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-[#1A2228] dark:text-[#F5FBFF]">
                                Agent #{agent.process_id.slice(-8)}
                              </h3>
                              <p className="text-sm text-[#565E64] dark:text-[#95A0A6]">
                                {agent.config.StrategyType} • {agent.config.Dex}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge
                              className={`rounded-lg font-medium ${
                                agent.status === "active"
                                  ? "bg-gradient-to-br from-green-50 to-green-100 text-green-800 dark:from-green-900/20 dark:to-green-800/20 dark:text-green-300"
                                  : agent.status === "ready"
                                  ? "bg-gradient-to-br from-blue-50 to-blue-100 text-blue-800 dark:from-blue-900/20 dark:to-blue-800/20 dark:text-blue-300"
                                  : "bg-gradient-to-br from-yellow-50 to-yellow-100 text-yellow-800 dark:from-yellow-900/20 dark:to-yellow-800/20 dark:text-yellow-300"
                              }`}
                            >
                              {agent.status}
                            </Badge>
                            <div className="text-xs text-[#565E64] dark:text-[#95A0A6] mt-1">
                              Created:{" "}
                              {new Date(agent.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center space-x-4 text-sm text-[#565E64] dark:text-[#95A0A6]">
                          <span>
                            Conversion: {agent.config.ConversionPercentage}%
                          </span>
                          <span>Slippage: {agent.config.Slippage}%</span>
                          {agent.config.RunIndefinitely ? (
                            <span>Run: Indefinitely</span>
                          ) : (
                            <span>
                              End:{" "}
                              {new Date(
                                agent.config.EndDate * 1000
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <DashboardFooter />
    </div>
  );
}
