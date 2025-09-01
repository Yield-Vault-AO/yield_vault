"use client";

import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import back_btn from "../../public/back.svg";
import ao_logo from "../../public/ao_logo.svg";
import DashboardFooter from "./dashboard/dashboard_footer";
import {
  getAgentInfo,
  withdrawFromAgent,
  // executeAgentStrategy,
  type AgentInfo,
} from "../services/aoService";
import { createDataItemSigner, message, result } from "@permaweb/aoconnect";
import { AO_TOKEN } from "../constants/yao_process";
import { getTokenBalance } from "../services/aoService";
import { formatTokenBalance, convertHumanAmountToBaseUnits } from "../helpers/token";

export default function Agent() {
  const { id } = useParams<{ id: string }>();
  const agentId = id || "";

  const [activeTab, setActiveTab] = useState("manage");
  const [depositWithdrawTab, setDepositWithdrawTab] = useState("deposit");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_loading, setLoading] = useState(true);
  const [agentInfoError, setAgentInfoError] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [baseTokenBalance, setBaseTokenBalance] = useState<string>("0");
  // const [isExecuting, setIsExecuting] = useState(false);

  // Fetch agent info
  useEffect(() => {
    const fetchAgentInfo = async () => {
      if (!agentId) return;

      setLoading(true);
      setAgentInfoError(null);

      try {
        const info = await getAgentInfo(agentId);
        console.log("Agent info received in component:", info);
        setAgentInfo(info as AgentInfo);
      } catch (err) {
        console.error("Failed to fetch agent info:", err);
        console.error("Error details:", err);
        setAgentInfoError("Failed to load agent information");
      } finally {
        setLoading(false);
      }
    };

    fetchAgentInfo();
  }, [agentId]);

  const SPECIAL_BASE = "0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc";
  const determineBaseToken = React.useCallback(() => {
    if (!agentInfo) return AO_TOKEN;
    const base = agentInfo["Base-Token"];
    if (base === SPECIAL_BASE || agentInfo["Token-Out"] === SPECIAL_BASE) return SPECIAL_BASE;
    return base || AO_TOKEN;
  }, [agentInfo]);

  const handleDeposit = async () => {
    if (!depositAmount || !agentId) return;

    setIsDepositing(true);
    setTransferError(null);
    try {
      const baseToken = determineBaseToken();
      const quantity = await convertHumanAmountToBaseUnits(baseToken, depositAmount);
      const messageId = await message({
        process: baseToken,
        tags: [
          { name: "Action", value: "Transfer" },
          { name: "Recipient", value: agentId },
          { name: "Quantity", value: quantity.toString() },
        ],
        data: "",
        signer: createDataItemSigner(window.arweaveWallet),
      });

      const messageResult = await result({
        process: baseToken,
        message: messageId,
      });

      if (messageResult.Messages?.[0]?.Data) {
        console.log("Deposit successful");
        setDepositAmount("");
        // Refresh agent info
        const info = await getAgentInfo(agentId);
        setAgentInfo(info as AgentInfo);
      }
    } catch (error) {
      console.error("Deposit failed:", error);
      setTransferError("Deposit failed. Please try again.");
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !agentId) return;

    setIsWithdrawing(true);
    setTransferError(null);
    try {
      await withdrawFromAgent(agentId, AO_TOKEN, withdrawAmount);
      setWithdrawAmount("");
      // Refresh agent info
      const info = await getAgentInfo(agentId);
      setAgentInfo(info as AgentInfo);
    } catch (error) {
      console.error("Withdrawal failed:", error);
      setTransferError("Withdrawal failed. Please try again.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  // const handleExecuteStrategy = async () => {
  //   if (!agentId) return;

  //   setIsExecuting(true);
  //   try {
  //     await executeAgentStrategy(agentId);
  //     // Refresh agent info
  //     const info = await getAgentInfo(agentId);
  //     setAgentInfo(info as AgentInfo);
  //   } catch (error) {
  //     console.error("Strategy execution failed:", error);
  //   } finally {
  //     setIsExecuting(false);
  //   }
  // };

  useEffect(() => {
    if (agentInfo) {
      console.log("Agent info received:", agentInfo);
      setAgentInfoError(null);
    }
  }, [agentInfo]);

  useEffect(() => {
    const loadBalance = async () => {
      try {
        if (!agentInfo) return;
        const address = await (window as unknown as { arweaveWallet?: { getActiveAddress?: () => Promise<string> } }).arweaveWallet?.getActiveAddress?.();
        if (!address) return;
        const baseToken = determineBaseToken();
        const bal = await getTokenBalance(baseToken, address);
        const formatted = await formatTokenBalance(baseToken, bal, { maxFractionDigits: 6 });
        setBaseTokenBalance(formatted);
      } catch (e) {
        console.warn("Failed to load base token balance:", e);
      }
    };
    loadBalance();
  }, [agentInfo, determineBaseToken]);

  // Skeleton components
  const SkeletonCard = ({
    className = "",
    children,
  }: {
    className?: string;
    children?: React.ReactNode;
  }) => (
    <Card
      className={`rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:from-[#10181D] dark:to-[#121A21] border border-[#EAEAEA] dark:border-[#192127] shadow-lg ${className}`}
    >
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );

  const SkeletonText = ({
    width = "w-full",
    height = "h-4",
  }: {
    width?: string;
    height?: string;
  }) => (
    <div
      className={`${width} ${height} bg-gray-200 dark:bg-gray-700 rounded animate-pulse`}
    ></div>
  );

  const SkeletonBadge = () => (
    <div className="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
  );

  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleDateString();
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff <= 0) return "Expired";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return { days, hours, minutes };
  };

  const timeRemaining =
    agentInfo && agentInfo["Run-Indefinitely"] === "true"
      ? null
      : agentInfo
      ? formatTime(agentInfo["End-Date"])
      : null;

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

        {/* Error Banner */}
        {agentInfoError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg
                className="w-5 h-5 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-red-600 dark:text-red-400 font-medium">
                {agentInfoError}
              </p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Agent Header */}
            <div>
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
                  <h1 className="text-2xl font-bold text-[#1A2228] dark:text-[#F5FBFF] flex items-center space-x-4">
                    <span>Agent #{agentId.slice(-8)}</span>
                  </h1>
                  {agentInfo ? (
                    <p className="text-[#565E64] dark:text-[#95A0A6]">
                      {agentInfo["Strategy-Type"]} • {agentInfo.Dex}
                    </p>
                  ) : (
                    <SkeletonText width="w-32" height="h-5" />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {agentInfo ? (
                  <>
                    <Badge
                      className={`rounded-lg font-medium ${
                        agentInfo.Status === "Active"
                          ? "bg-gradient-to-br from-green-50 to-green-100 text-green-800 dark:from-green-900/20 dark:to-green-800/20 dark:text-green-300"
                          : agentInfo.Status === "Ready"
                          ? "bg-gradient-to-br from-blue-50 to-blue-100 text-blue-800 dark:from-blue-900/20 dark:to-blue-800/20 dark:text-blue-300"
                          : "bg-gradient-to-br from-yellow-50 to-yellow-100 text-yellow-800 dark:from-yellow-900/20 dark:to-yellow-800/20 dark:text-yellow-300"
                      }`}
                    >
                      {agentInfo.Status}
                    </Badge>

                    <Badge className="rounded-lg bg-gradient-to-br from-[#4C545A] to-[#060E14] dark:from-[#DAD9D9E5] dark:to-[#F8F7F4] text-white dark:text-[#1A2228] font-medium">
                      Slippage: {agentInfo.Slippage}%
                    </Badge>

                    <Badge className="rounded-lg bg-gradient-to-br from-[#4C545A] to-[#060E14] dark:from-[#DAD9D9E5] dark:to-[#F8F7F4] text-white dark:text-[#1A2228] font-medium">
                      Conversion: {agentInfo["Conversion-Percentage"]}%
                    </Badge>
                  </>
                ) : (
                  <>
                    <SkeletonBadge />
                    <SkeletonBadge />
                    <SkeletonBadge />
                  </>
                )}
              </div>
            </div>

            {/* Time Remaining or Indefinite */}
            {!agentInfo ? (
              <SkeletonCard>
                <div className="text-center">
                  <SkeletonText width="w-48 mx-auto" height="h-6" />
                  <div className="mt-2">
                    <SkeletonText width="w-64 mx-auto" height="h-4" />
                  </div>
                </div>
              </SkeletonCard>
            ) : agentInfo["Run-Indefinitely"] === "true" ? (
              <Card className="rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:from-[#10181D] dark:to-[#121A21] border border-[#EAEAEA] dark:border-[#192127] shadow-lg">
                <CardContent className="p-6 text-center">
                  <h3 className="text-[#1A2228] dark:text-[#F5FBFF] text-xl mb-2">
                    Running Indefinitely
                  </h3>
                  <p className="text-[#565E64] dark:text-[#95A0A6]">
                    This agent will continue running until manually stopped
                  </p>
                </CardContent>
              </Card>
            ) : timeRemaining && typeof timeRemaining === "object" ? (
              <div>
                <h3 className="text-[#1A2228] dark:text-[#F5FBFF] text-xl mb-4">
                  Time Remaining:
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <Card className="rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:from-[#10181D] dark:to-[#121A21] shadow-lg">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-[#1A2228] dark:text-[#F5FBFF]">
                        {timeRemaining.days}
                      </div>
                      <div className="text-[#565E64] dark:text-[#95A0A6] text-sm">
                        Days
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:from-[#10181D] dark:to-[#121A21] shadow-lg">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-[#1A2228] dark:text-[#F5FBFF]">
                        {timeRemaining.hours}
                      </div>
                      <div className="text-[#565E64] dark:text-[#95A0A6] text-sm">
                        Hours
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:from-[#10181D] dark:to-[#121A21] shadow-lg">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-[#1A2228] dark:text-[#F5FBFF]">
                        {timeRemaining.minutes}
                      </div>
                      <div className="text-[#565E64] dark:text-[#95A0A6] text-sm">
                        Min
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <Card className="rounded-lg bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border border-red-200 dark:border-red-800 shadow-lg">
                <CardContent className="p-6 text-center">
                  <h3 className="text-red-800 dark:text-red-200 text-xl mb-2">
                    Agent Expired
                  </h3>
                  <p className="text-red-700 dark:text-red-300">
                    This agent has reached its end date
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Statistics */}
            <Card className="rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:from-[#10181D] dark:to-[#121A21] border border-[#EAEAEA] dark:border-[#192127] shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-[#1A2228] dark:text-[#F5FBFF] mb-4">
                  Performance Statistics
                </h3>
                {agentInfo ? (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[#565E64] dark:text-[#95A0A6]">
                        Total Transactions:
                      </span>
                      <span className="font-semibold text-[#1A2228] dark:text-[#F5FBFF] ml-2">
                        {agentInfo["Total-Transactions"]}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#565E64] dark:text-[#95A0A6]">
                        Total Swaps:
                      </span>
                      <span className="font-semibold text-[#1A2228] dark:text-[#F5FBFF] ml-2">
                        {agentInfo["Total-Swaps"]}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#565E64] dark:text-[#95A0A6]">
                        Total LPs:
                      </span>
                      <span className="font-semibold text-[#1A2228] dark:text-[#F5FBFF] ml-2">
                        {agentInfo["Total-LPs"]}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#565E64] dark:text-[#95A0A6]">
                        AO Sold:
                      </span>
                      <span className="font-semibold text-[#1A2228] dark:text-[#F5FBFF] ml-2">
                        {agentInfo["Total-AO-Sold"]}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <SkeletonText width="w-24" />
                      <SkeletonText width="w-12" />
                    </div>
                    <div className="flex justify-between">
                      <SkeletonText width="w-20" />
                      <SkeletonText width="w-8" />
                    </div>
                    <div className="flex justify-between">
                      <SkeletonText width="w-16" />
                      <SkeletonText width="w-10" />
                    </div>
                    <div className="flex justify-between">
                      <SkeletonText width="w-14" />
                      <SkeletonText width="w-16" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Execute Strategy Button */}
            {/* <Button
              onClick={handleExecuteStrategy}
              disabled={isExecuting || !agentInfo || agentInfo.Status !== 'Active'}
              className="w-full h-12 rounded-lg bg-gradient-to-br from-[#4C545A] to-[#060E14] dark:bg-gradient-to-br dark:from-[#DAD9D9E5] dark:to-[#F8F7F4] dark:text-[#1A2228] text-white font-semibold hover:scale-105 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:hover:scale-100"
            >
              {!agentInfo ? (
                <SkeletonText width="w-32" height="h-5" />
              ) : isExecuting ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white dark:border-[#1A2228]"></div>
                  <span>Executing...</span>
                </div>
              ) : (
                "Execute Strategy"
              )}
            </Button> */}
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
                onClick={() => setDepositWithdrawTab("withdraw")}
                variant="default"
                className={`flex-1 py-7 rounded-tl-2xl rounded-tr-2xl rounded-bl-sm rounded-br-sm ${
                  depositWithdrawTab === "withdraw"
                    ? "bg-[#D6EEF6] dark:bg-[#052834] dark:text-[#30CFFF] hover:bg-[#D6EEF6]/60 text-[#25A8CF]"
                    : "bg-transparent text-[#25A8CF]"
                }`}
              >
                Withdraw
              </Button>
            </div>

            <Card className="bg-[#F3F3F3] dark:bg-[#141C22] dark:border-[#083341] border-none md:dark:border-solid">
              <CardContent className="px-6 py-3">
                {transferError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-600 dark:text-red-400 text-sm">
                      {transferError}
                    </p>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 border border-[#DAD9D9E5] dark:border-[#222A30] p-2 rounded-3xl cursor-pointer">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center">
                        <img src={ao_logo} alt="ao token" />
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
                      <div className="text-[#7E868C] dark:text-[#95A0A6] text-sm">
                        {depositWithdrawTab === "deposit" ? "Wallet Balance" : "Agent Balance"}
                      </div>
                      <div className="font-medium text-lg text-[#565E64] dark:text-[#EAEAEA]">
                        {depositWithdrawTab === "deposit" ? baseTokenBalance : "Loading..."}
                      </div>
                    </div>
                  </div>

                  <div className="relative flex items-center justify-between space-x-4">
                    <Input
                      type="text"
                      placeholder="$ 0.00"
                      value={
                        depositWithdrawTab === "deposit"
                          ? depositAmount
                          : withdrawAmount
                      }
                      onChange={(e) => {
                        if (depositWithdrawTab === "deposit") {
                          setDepositAmount(e.target.value);
                        } else {
                          setWithdrawAmount(e.target.value);
                        }
                      }}
                      className="text-left text-2xl py-7 text-[#95A0A6] w-full border-none bg-[#EAEAEA] dark:bg-[#1B2329] focus:ring-0"
                    />
                    <div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[#7E868C] gradient-card px-4 py-7"
                        onClick={() => {
                          // In a real implementation, you'd get the actual balance
                          const maxAmount = "1000";
                          if (depositWithdrawTab === "deposit") {
                            setDepositAmount(maxAmount);
                          } else {
                            setWithdrawAmount(maxAmount);
                          }
                        }}
                      >
                        Max
                      </Button>
                    </div>
                  </div>
                  <div className="text-[#7e868c] text-xs">≈ 0.00 AR</div>

                  <Button
                    className="w-full !mt-7 bg-[#D6EEF6] dark:bg-[#052834] hover:bg-[#97c2d1] text-[#25A8CF] dark:text-[#30CFFF] h-12"
                    disabled={
                      !(depositAmount || withdrawAmount) ||
                      (depositWithdrawTab === "deposit"
                        ? isDepositing
                        : isWithdrawing)
                    }
                    onClick={() => {
                      if (depositWithdrawTab === "deposit") {
                        handleDeposit();
                      } else {
                        handleWithdraw();
                      }
                    }}
                  >
                    {depositWithdrawTab === "deposit" ? (
                      isDepositing ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#25A8CF]"></div>
                          <span>Depositing...</span>
                        </div>
                      ) : (
                        "Deposit"
                      )
                    ) : isWithdrawing ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#25A8CF]"></div>
                        <span>Withdrawing...</span>
                      </div>
                    ) : (
                      "Withdraw"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="mt-8 sm:mt-12">
          <div className="flex flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-6 mt-4 sm:mt-6 md:mt-20 border-b border-[#e6e6e6] dark:border-[#192127]">
            <div className="flex flex-wrap gap-2 sm:gap-4 flex-1">
              {["Manage", "Details", "Configuration"].map((tab) => (
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
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="space-y-4 sm:space-y-6">
            {activeTab === "manage" && (
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-[#1A2228] dark:text-[#F5FBFF] mb-3 sm:mb-4">
                  Agent Management
                </h3>
                {agentInfo ? (
                  <p className="text-[#565E64] dark:text-[#95A0A6] text-sm leading-relaxed mb-4 sm:mb-6">
                    This agent automatically executes the{" "}
                    {agentInfo["Strategy-Type"]} strategy on the {agentInfo.Dex}{" "}
                    DEX. It converts {agentInfo["Conversion-Percentage"]}% of
                    deposited tokens through swaps and liquidity provision.
                  </p>
                ) : (
                  <div className="mb-4 sm:mb-6">
                    <SkeletonText width="w-full" height="h-4" />
                    <div className="mt-2">
                      <SkeletonText width="w-3/4" height="h-4" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:from-[#10181D] dark:to-[#121A21] border border-[#EAEAEA] dark:border-[#192127] shadow-lg">
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-[#1A2228] dark:text-[#F5FBFF] mb-2">
                        Current Status
                      </h4>
                      {agentInfo ? (
                        <>
                          <p className="text-sm text-[#565E64] dark:text-[#95A0A6]">
                            Swap in Progress: {agentInfo["Swap-In-Progress"]}
                          </p>
                          <p className="text-sm text-[#565E64] dark:text-[#95A0A6]">
                            LP Flow Active: {agentInfo["LP-Flow-Active"]}
                          </p>
                        </>
                      ) : (
                        <>
                          <SkeletonText width="w-full" height="h-4" />
                          <div className="mt-2">
                            <SkeletonText width="w-3/4" height="h-4" />
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:from-[#10181D] dark:to-[#121A21] border border-[#EAEAEA] dark:border-[#192127] shadow-lg">
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-[#1A2228] dark:text-[#F5FBFF] mb-2">
                        Token Information
                      </h4>
                      {agentInfo ? (
                        <>
                          <p className="text-sm text-[#565E64] dark:text-[#95A0A6]">
                            Base Token: {agentInfo["Base-Token"]}
                          </p>
                          <p className="text-sm text-[#565E64] dark:text-[#95A0A6]">
                            Token Out: {agentInfo["Token-Out"]}
                          </p>
                        </>
                      ) : (
                        <>
                          <SkeletonText width="w-full" height="h-4" />
                          <div className="mt-2">
                            <SkeletonText width="w-2/3" height="h-4" />
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === "details" && (
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-[#1A2228] dark:text-[#F5FBFF] mb-3 sm:mb-4">
                  Agent Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-[#1A2228] dark:text-[#F5FBFF] mb-2">
                      Timing
                    </h4>
                    {agentInfo ? (
                      <>
                        <p className="text-sm text-[#565E64] dark:text-[#95A0A6]">
                          Start Date: {formatDate(agentInfo["Start-Date"])}
                        </p>
                        <p className="text-sm text-[#565E64] dark:text-[#95A0A6]">
                          End Date:{" "}
                          {agentInfo["Run-Indefinitely"] === "true"
                            ? "Indefinite"
                            : formatDate(agentInfo["End-Date"])}
                        </p>
                      </>
                    ) : (
                      <>
                        <SkeletonText width="w-full" height="h-4" />
                        <div className="mt-2">
                          <SkeletonText width="w-3/4" height="h-4" />
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#1A2228] dark:text-[#F5FBFF] mb-2">
                      Performance
                    </h4>
                    {agentInfo ? (
                      <>
                        <p className="text-sm text-[#565E64] dark:text-[#95A0A6]">
                          Swap Value: {agentInfo["Total-Swap-Value"]}
                        </p>
                        <p className="text-sm text-[#565E64] dark:text-[#95A0A6]">
                          LP Value: {agentInfo["Total-LP-Value"]}
                        </p>
                      </>
                    ) : (
                      <>
                        <SkeletonText width="w-full" height="h-4" />
                        <div className="mt-2">
                          <SkeletonText width="w-2/3" height="h-4" />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "configuration" && (
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-[#1A2228] dark:text-[#F5FBFF] mb-3 sm:mb-4">
                  Configuration
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-[#565E64] dark:text-[#95A0A6]">
                        DEX
                      </label>
                      {agentInfo ? (
                        <p className="text-[#1A2228] dark:text-[#F5FBFF]">
                          {agentInfo.Dex}
                        </p>
                      ) : (
                        <SkeletonText width="w-20" height="h-5" />
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#565E64] dark:text-[#95A0A6]">
                        Strategy Type
                      </label>
                      {agentInfo ? (
                        <p className="text-[#1A2228] dark:text-[#F5FBFF]">
                          {agentInfo["Strategy-Type"]}
                        </p>
                      ) : (
                        <SkeletonText width="w-24" height="h-5" />
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#565E64] dark:text-[#95A0A6]">
                        Slippage Tolerance
                      </label>
                      {agentInfo ? (
                        <p className="text-[#1A2228] dark:text-[#F5FBFF]">
                          {agentInfo.Slippage}%
                        </p>
                      ) : (
                        <SkeletonText width="w-12" height="h-5" />
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#565E64] dark:text-[#95A0A6]">
                        Conversion Percentage
                      </label>
                      {agentInfo ? (
                        <p className="text-[#1A2228] dark:text-[#F5FBFF]">
                          {agentInfo["Conversion-Percentage"]}%
                        </p>
                      ) : (
                        <SkeletonText width="w-16" height="h-5" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <DashboardFooter />
    </div>
  );
}
