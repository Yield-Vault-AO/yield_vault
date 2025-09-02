/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  message,
  result,
  dryrun,
  createDataItemSigner,
} from "@permaweb/aoconnect";
import { MANAGER_CONTRACT } from "../constants/yao_process";
import type {
  RiskAssessmentData,
  Pool,
} from "../components/recommendation/types";

// Backend API configuration
const API_BASE = import.meta.env.VITE_BACKEND_URL || "https://yield-pools.apps.ikem.dev";

export interface AIRecommendation {
  pool_id: string;
  dex: string;
  token_pair: string;
  apy: string;
  risk_level: string;
  reasoning: string;
  match_score: number;
}

export interface AIRecommendationsResponse {
  recommendations: AIRecommendation[];
}

export interface AgentSpawnConfig {
  dex: string;
  tokenOut: string;
  slippage: number;
  startDate: number;
  endDate: number;
  runIndefinitely: boolean;
  conversionPercentage: number;
  strategyType: string;
  baseToken: string;
  poolId?: string;
  poolIdReference?: string;
}

export interface AgentRecord {
  process_id: string;
  pool_id: string;
  status: string;
  created_at: number; // This is in milliseconds from the Manager Contract
  config: {
    Slippage: number;
    StartDate: number;
    PoolIdOverride?: string;
    EndDate: number;
    Dex: string;
    StrategyType: string;
    ConversionPercentage: number;
    BaseToken: string;
    AgentOwner: string;
    TokenOut: string;
    RunIndefinitely: boolean;
  };
}

/**
 * Get AI-powered pool recommendations from Manager Contract
 */
export async function getAIRecommendations(
  riskData: RiskAssessmentData
): Promise<Pool[]> {
  try {
    console.log(
      "Requesting AI recommendations from Manager Contract:",
      riskData
    );

    // Send message to Manager Contract
    const messageId = await message({
      process: MANAGER_CONTRACT,
      tags: [{ name: "Action", value: "Get-AI-Recommendations" }],
      data: JSON.stringify(riskData),
      signer: createDataItemSigner(window.arweaveWallet),
    });

    console.log("AI recommendations request sent, message ID:", messageId);

    // Get the result
    const response = await result({
      message: messageId,
      process: MANAGER_CONTRACT,
    });

    console.log("AI recommendations response:", response);

    // Check if we got a pending response first
    if (response.Messages && response.Messages.length > 0) {
      const lastMessage = response.Messages[response.Messages.length - 1];

      if (lastMessage.Tags) {
        const actionTag = lastMessage.Tags.find(
          (tag: any) => tag.name === "Action"
        );
        const errorTag = lastMessage.Tags.find(
          (tag: any) => tag.name === "Error"
        );

        if (actionTag?.value === "AI-Recommendations-Response") {
          return await parseAIResponse(response);
        } else if (actionTag?.value === "AI-Recommendations-Error") {
          throw new Error(errorTag?.value || "AI recommendations failed");
        }
      }
    }

    throw new Error("No valid response received from Manager Contract");
  } catch (error) {
    console.error("Error getting AI recommendations:", error);
    throw new Error("Failed to get AI recommendations from Manager Contract");
  }
}

export interface RandomRecommendation {
  pool_id: string;
  dex: string;
  token_pair: string;
  apy: string;
  risk_level: string;
  reasoning: string;
  entropy?: number;
  callback_id?: string;
}

export interface RandomRecommendationResponse {
  recommendation: RandomRecommendation;
}

/**
 * Request a random recommendation and wait (poll) until available.
 * Returns the selected pool_id.
 */
export async function getRandomRecommendationPoolId(
  { pollIntervalMs = 1500, maxAttempts = 20 }: { pollIntervalMs?: number; maxAttempts?: number } = {}
): Promise<string> {
  console.log("Requesting random recommendation from Manager Contract");

  if (!window.arweaveWallet) {
    throw new Error("Wallet not connected");
  }

  // Send request
  const messageId = await message({
    process: MANAGER_CONTRACT,
    tags: [{ name: "Action", value: "Get-Random-Recommendation" }],
    signer: createDataItemSigner(window.arweaveWallet),
  });

  const initial = await result({ message: messageId, process: MANAGER_CONTRACT });
  const immediate = tryParseRandomResponse(initial);
  if (immediate?.pool_id) {
    return immediate.pool_id;
  }

  const { sessionId, callbackId } = extractRandomSession(initial);
  if (!sessionId && !callbackId) {
    throw new Error("No session identifiers returned for random recommendation");
  }

  // Poll status via dryrun
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    const response = await dryrun({
      process: MANAGER_CONTRACT,
      tags: [
        { name: "Action", value: "Get-Random-Recommendation-Status" },
        ...(sessionId ? [{ name: "Session-Id", value: sessionId }] : []),
        ...(callbackId ? [{ name: "Callback-Id", value: callbackId }] : []),
      ],
    });

    const parsed = tryParseRandomResponse(response);
    if (parsed?.pool_id) {
      return parsed.pool_id;
    }
  }

  throw new Error("Random recommendation timed out");
}

function extractRandomSession(response: any): { sessionId?: string; callbackId?: string } {
  if (!response?.Messages?.length) return {};
  const lastMessage = response.Messages[response.Messages.length - 1];
  const getTag = (n: string) => lastMessage.Tags?.find((t: any) => t.name === n)?.value;
  const sessionId = getTag("Session-Id");
  const callbackId = getTag("Callback-Id");
  return { sessionId, callbackId };
}

function tryParseRandomResponse(response: any): { pool_id?: string } | undefined {
  try {
    if (!response?.Messages?.length) return;
    const lastMessage = response.Messages[response.Messages.length - 1];
    const action = lastMessage.Tags?.find((t: any) => t.name === "Action")?.value;
    if (action !== "Random-Recommendation-Response") return;
    const data = JSON.parse(lastMessage.Data) as RandomRecommendationResponse;
    return { pool_id: data?.recommendation?.pool_id };
  } catch (e) {
    console.warn("Failed to parse random recommendation response", e);
  }
}

/**
 * Parse AI recommendations response and convert to Pool format
 */
async function parseAIResponse(response: any): Promise<Pool[]> {
  try {
    if (!response.Messages || response.Messages.length === 0) {
      throw new Error("No messages in response");
    }

    const lastMessage = response.Messages[response.Messages.length - 1];
    const actionTag = lastMessage.Tags?.find(
      (tag: { name: string; value: string }) => tag.name === "Action"
    );

    if (actionTag?.value !== "AI-Recommendations-Response") {
      throw new Error("Invalid response action");
    }

    const data = JSON.parse(lastMessage.Data) as AIRecommendationsResponse;

    if (!data.recommendations || !Array.isArray(data.recommendations)) {
      throw new Error("Invalid recommendations format");
    }

    // Fetch complete pool data from backend to get token processes
    let backendPools: any[] = [];
    try {
      const backendResponse = await fetch(`${API_BASE}/pools`);
      if (backendResponse.ok) {
        backendPools = await backendResponse.json();
        console.log(
          "Fetched backend pools for token data:",
          backendPools.length
        );
      }
    } catch (error) {
      console.warn("Failed to fetch backend pools, using AI data only:", error);
    }

    // Convert AI recommendations to Pool format with backend token data
    return data.recommendations.map((rec): Pool => {
      // Find matching pool in backend data by amm_process
      const backendPool = backendPools.find(
        (pool) => pool.amm_process === rec.pool_id
      );

      if (backendPool) {
        console.log("Found matching backend pool for", rec.pool_id, ":", {
          token0: backendPool.token0,
          token1: backendPool.token1,
          token0_ticker: backendPool.token0_ticker,
          token1_ticker: backendPool.token1_ticker,
        });

        return {
          id: rec.pool_id,
          name: rec.token_pair,
          apy: rec.apy,
          risk: rec.risk_level,
          tokens: [backendPool.token0_ticker, backendPool.token1_ticker],
          description: rec.reasoning,
          tvl: backendPool.liquidity_usd
            ? `$${backendPool.liquidity_usd.toLocaleString()}`
            : "N/A",
          verified: true,
          amm_process: rec.pool_id,
          // Use backend pool data for accurate token processes
          token0: backendPool.token0,
          token1: backendPool.token1,
          token0_ticker: backendPool.token0_ticker,
          token1_ticker: backendPool.token1_ticker,
          token0_name: backendPool.token0_name,
          token1_name: backendPool.token1_name,
        };
      } else {
        // Fallback to parsing token pair if no backend data found
        console.warn(
          "No backend pool data found for",
          rec.pool_id,
          "using token pair parsing"
        );
        const tokens = rec.token_pair.includes("/")
          ? rec.token_pair.split("/")
          : [rec.token_pair];
        const token0 = tokens[0]?.trim();
        const token1 = tokens[1]?.trim();

        return {
          id: rec.pool_id,
          name: rec.token_pair,
          apy: rec.apy,
          risk: rec.risk_level,
          tokens: tokens,
          description: rec.reasoning,
          tvl: "N/A",
          verified: true,
          amm_process: rec.pool_id,
          token0: token0,
          token1: token1,
          token0_ticker: token0,
          token1_ticker: token1,
          token0_name: token0,
          token1_name: token1,
        };
      }
    });
  } catch (error) {
    console.error("Error parsing AI response:", error);
    throw new Error("Failed to parse AI recommendations response");
  }
}

/**
 * Spawn a new agent via Manager Contract
 */
export async function spawnAgent(config: AgentSpawnConfig): Promise<string> {
  try {
    console.log("Spawning agent via Manager Contract:", config);

    const messageId = await message({
      process: MANAGER_CONTRACT,
      tags: [
        { name: "Action", value: "Spawn-Agent" },
        { name: "Dex", value: config.dex },
        { name: "Token-Out", value: config.tokenOut },
        { name: "Slippage", value: config.slippage.toString() },
        { name: "Start-Date", value: config.startDate.toString() },
        { name: "End-Date", value: config.endDate.toString() },
        { name: "Run-Indefinitely", value: config.runIndefinitely.toString() },
        {
          name: "Conversion-Percentage",
          value: config.conversionPercentage.toString(),
        },
        { name: "Strategy-Type", value: config.strategyType },
        { name: "Base-Token", value: config.baseToken },
        ...(config.poolId ? [{ name: "Pool-Id", value: config.poolId }] : []),
        ...(config.poolIdReference
          ? [{ name: "Pool-Id-Reference", value: config.poolIdReference }]
          : []),
      ],
      signer: createDataItemSigner(window.arweaveWallet),
    });

    console.log("Agent spawn request sent, message ID:", messageId);

    // Get the result
    const response = await result({
      message: messageId,
      process: MANAGER_CONTRACT,
    });

    console.log("Agent spawn response:", response);

    if (response.Messages && response.Messages.length > 0) {
      const lastMessage = response.Messages[response.Messages.length - 1];
      const actionTag = lastMessage.Tags?.find(
        (tag: { name: string; value: string }) => tag.name === "Action"
      );

      if (actionTag?.value === "Spawn-Agent-Pending") {
        const sessionIdTag = lastMessage.Tags?.find(
          (tag: { name: string }) => tag.name === "Session-Id"
        );

        // Wait for agent to be spawned (simplified approach)
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // In a real implementation, you would poll for the spawned agent
        // For now, return the session ID as a placeholder
        return sessionIdTag?.value || "pending";
      } else if (actionTag?.value === "Spawn-Agent-Error") {
        const errorTag = lastMessage.Tags?.find(
          (tag: { name: string }) => tag.name === "Error"
        );
        throw new Error(errorTag?.value || "Agent spawn failed");
      }
    }

    throw new Error("No valid response received from Manager Contract");
  } catch (error) {
    console.error("Error spawning agent:", error);
    throw new Error("Failed to spawn agent via Manager Contract");
  }
}

/**
 * Get user's agents from Manager Contract
 */
export async function getUserAgents(
  userAddress?: string
): Promise<AgentRecord[]> {
  try {
    console.log(
      "Getting user agents from Manager Contract",
      userAddress ? `for user: ${userAddress}` : ""
    );

    const response = await dryrun({
      process: MANAGER_CONTRACT,
      tags: [
        { name: "Action", value: "Get-User-Agents" },
        ...(userAddress ? [{ name: "User-Address", value: userAddress }] : []),
      ],
    });

    console.log("User agents response:", response);
    console.log("Response Messages length:", response.Messages?.length);

    if (response.Messages && response.Messages.length > 0) {
      const lastMessage = response.Messages[response.Messages.length - 1];
      console.log("Last message:", lastMessage);
      console.log("Last message Tags:", lastMessage.Tags);
      console.log("Last message Action:", lastMessage.Tags?.Action);

      // Find the message with User-Agents-Response action
      const responseMessage = response.Messages.find((msg) =>
        msg.Tags?.some(
          (tag: { name: string; value: string }) =>
            tag.name === "Action" && tag.value === "User-Agents-Response"
        )
      );

      if (responseMessage) {
        console.log("Found User-Agents-Response message:", responseMessage);
        try {
          const data = JSON.parse(responseMessage.Data) as AgentRecord[];
          console.log("Parsed agent data:", data);
          return data;
        } catch (parseError) {
          console.error("Failed to parse agent data:", parseError);
          console.log("Raw data:", responseMessage.Data);
          throw new Error("Failed to parse agent data from Manager Contract");
        }
      } else if (
        lastMessage.Tags?.some(
          (tag: { name: string; value: string }) =>
            tag.name === "Action" && tag.value === "User-Agents-Error"
        )
      ) {
        const errorTag = lastMessage.Tags?.find(
          (tag: { name: string }) => tag.name === "Error"
        );
        throw new Error(errorTag?.value || "Failed to get user agents");
      } else {
        console.log("No User-Agents-Response message found");
        console.log("All messages:", response.Messages);
      }
    }

    return [];
  } catch (error) {
    console.error("Error getting user agents:", error);
    throw new Error("Failed to get user agents from Manager Contract");
  }
}

/**
 * Get available pools from Manager Contract
 */
export async function getAvailablePools(): Promise<Pool[]> {
  try {
    console.log("Getting available pools from Manager Contract");

    const response = await dryrun({
      process: MANAGER_CONTRACT,
      tags: [{ name: "Action", value: "Get-Available-Pools" }],
    });

    if (response.Messages && response.Messages.length > 0) {
      const responseMessage = response.Messages.find((msg) =>
        msg.Tags?.some(
          (tag: { name: string; value: string }) =>
            tag.name === "Action" && tag.value === "Available-Pools-Response"
        )
      );

      if (responseMessage) {
        const poolsData = JSON.parse(responseMessage.Data);

        // Convert Manager Contract pool format to frontend Pool format
        return poolsData.map(
          (pool: any): Pool => ({
            id: pool.id,
            name: pool.name,
            apy: pool.apy,
            risk: pool.risk_level,
            tokens: [pool.token_a, pool.token_b], // Simplified - you might want to resolve token symbols
            description: pool.description,
            tvl: pool.tvl,
            verified: pool.verified,
          })
        );
      }
    }

    return [];
  } catch (error) {
    console.error("Error getting available pools:", error);
    throw new Error("Failed to get available pools from Manager Contract");
  }
}

export interface AgentInfo {
  "Start-Date": string;
  "End-Date": string;
  Dex: string;
  "Token-Out": string;
  "Base-Token": string;
  "Pool-Id": string;
  Slippage: string;
  Status: string;
  "Run-Indefinitely": string;
  "Conversion-Percentage": string;
  "Strategy-Type": string;
  "Agent-Version": string;
  "Total-Transactions": string;
  "Total-AO-Sold": string;
  "Total-Swaps": string;
  "Total-Swap-Value": string;
  "Total-LPs": string;
  "Total-LP-Value": string;
  "Total-LP-Transactions": string;
  "Total-LP-Tokens": string;
  "Total-Bought": string;
  "Swap-In-Progress": string;
  "Processed-Up-To-Date": string;
  "Swapped-Up-To-Date": string;
  "LP-Flow-Active": string;
  "LP-Flow-State": string;
}

/**
 * Get a user's balance for a given token (AO token process) via dryrun
 */
export async function getTokenBalance(
  tokenProcessId: string,
  address: string
): Promise<string> {
  try {
    const tryOnce = async (actionName: string) =>
      await dryrun({
        process: tokenProcessId,
        tags: [
          { name: "Action", value: actionName },
          { name: "Target", value: address },
        ],
      });

    const response = await tryOnce("Balance");

    if (response?.Messages && response.Messages.length > 0) {
      const lastMessage = response.Messages[response.Messages.length - 1];
      if (lastMessage.Data) {
        return String(lastMessage.Data);
      }
      const balTag = lastMessage.Tags?.find(
        (t: { name: string; value: string }) => t.name === "Balance"
      );
      if (balTag?.value) {
        return balTag.value;
      }
    }
  } catch (error) {
    console.warn("getTokenBalance failed:", error);
  }
  return "0";
}

/**
 * Get agent info by calling Info action on the agent process
 */
export async function getAgentInfo(
  agentProcessId: string
): Promise<AgentInfo | undefined> {
  console.log("Getting agent info for process:", agentProcessId);

  const response = await dryrun({
    process: agentProcessId,
    tags: [{ name: "Action", value: "Info" }],
  });

  console.log("Agent info response:", response);

  if (response.Messages && response.Messages.length > 0) {
    const lastMessage = response.Messages[response.Messages.length - 1];
    console.log("Last message tags:", lastMessage.Tags);

    // Find the message with Info-Response action
    const responseMessage = response.Messages.find((msg) =>
      msg.Tags?.some(
        (tag: { name: string; value: string }) =>
          tag.name === "Action" && tag.value === "Info-Response"
      )
    );

    if (responseMessage) {
      console.log("Found Info-Response message:", responseMessage);

      // Convert tags array to AgentInfo object
      const agentInfo: Partial<AgentInfo> = {};

      responseMessage.Tags?.forEach((tag: { name: string; value: string }) => {
        // Map tag names to AgentInfo properties
        switch (tag.name) {
          case "Start-Date":
            agentInfo["Start-Date"] = tag.value;
            break;
          case "End-Date":
            agentInfo["End-Date"] = tag.value;
            break;
          case "Dex":
            agentInfo.Dex = tag.value;
            break;
          case "Token-Out":
            agentInfo["Token-Out"] = tag.value;
            break;
          case "Base-Token":
            agentInfo["Base-Token"] = tag.value;
            break;
          case "Pool-Id":
            agentInfo["Pool-Id"] = tag.value;
            break;
          case "Slippage":
            agentInfo.Slippage = tag.value;
            break;
          case "Status":
            agentInfo.Status = tag.value;
            break;
          case "Run-Indefinitely":
            agentInfo["Run-Indefinitely"] = tag.value;
            break;
          case "Conversion-Percentage":
            agentInfo["Conversion-Percentage"] = tag.value;
            break;
          case "Strategy-Type":
            agentInfo["Strategy-Type"] = tag.value;
            break;
          case "Agent-Version":
            agentInfo["Agent-Version"] = tag.value;
            break;
          case "Total-Transactions":
            agentInfo["Total-Transactions"] = tag.value;
            break;
          case "Total-AO-Sold":
            agentInfo["Total-AO-Sold"] = tag.value;
            break;
          case "Total-Swaps":
            agentInfo["Total-Swaps"] = tag.value;
            break;
          case "Total-Swap-Value":
            agentInfo["Total-Swap-Value"] = tag.value;
            break;
          case "Total-LPs":
            agentInfo["Total-LPs"] = tag.value;
            break;
          case "Total-LP-Value":
            agentInfo["Total-LP-Value"] = tag.value;
            break;
          case "Total-LP-Transactions":
            agentInfo["Total-LP-Transactions"] = tag.value;
            break;
          case "Total-LP-Tokens":
            agentInfo["Total-LP-Tokens"] = tag.value;
            break;
          case "Total-Bought":
            agentInfo["Total-Bought"] = tag.value;
            break;
          case "Swap-In-Progress":
            agentInfo["Swap-In-Progress"] = tag.value;
            break;
          case "Processed-Up-To-Date":
            agentInfo["Processed-Up-To-Date"] = tag.value;
            break;
          case "Swapped-Up-To-Date":
            agentInfo["Swapped-Up-To-Date"] = tag.value;
            break;
          case "LP-Flow-Active":
            agentInfo["LP-Flow-Active"] = tag.value;
            break;
          case "LP-Flow-State":
            agentInfo["LP-Flow-State"] = tag.value;
            break;
        }
      });

      console.log("Parsed agent info:", agentInfo);
      return agentInfo as AgentInfo;
    }
  }
}

/**
 * Withdraw tokens from agent
 */
export async function withdrawFromAgent(
  agentProcessId: string,
  tokenId: string,
  quantity?: string,
  transferAll?: boolean
): Promise<void> {
  try {
    console.log("Withdrawing from agent:", {
      agentProcessId,
      tokenId,
      quantity,
      transferAll,
    });

    if (!window.arweaveWallet) {
      throw new Error("Wallet not connected");
    }

    const tags = [
      { name: "Action", value: "Withdraw" },
      { name: "Token-Id", value: tokenId },
    ];

    if (transferAll) {
      tags.push({ name: "Transfer-All", value: "true" });
    } else if (quantity) {
      tags.push({ name: "Quantity", value: quantity });
    }

    const messageId = await message({
      process: agentProcessId,
      tags,
      signer: createDataItemSigner(window.arweaveWallet),
    });

    const response = await result({
      message: messageId,
      process: agentProcessId,
    });

    if (response.Messages && response.Messages.length > 0) {
      const lastMessage = response.Messages[response.Messages.length - 1];

      // Check for success or error in tags
      const actionTag = lastMessage.Tags?.find(
        (tag: { name: string; value: string }) => tag.name === "Action"
      );

      if (actionTag?.value === "Withdraw-Success") {
        console.log("Withdrawal successful");
        return;
      } else if (actionTag?.value === "Withdraw-Error") {
        const errorTag = lastMessage.Tags?.find(
          (tag: { name: string }) => tag.name === "Error"
        );
        throw new Error(errorTag?.value || "Withdrawal failed");
      }
    }

    throw new Error("No valid response received from agent");
  } catch (error) {
    console.error("Error withdrawing from agent:", error);
    throw new Error("Failed to withdraw from agent");
  }
}

/**
 * Execute strategy on agent
 */
export async function executeAgentStrategy(
  agentProcessId: string
): Promise<void> {
  try {
    console.log("Executing strategy on agent:", agentProcessId);

    if (!window.arweaveWallet) {
      throw new Error("Wallet not connected");
    }

    const messageId = await message({
      process: agentProcessId,
      tags: [{ name: "Action", value: "Execute-Strategy" }],
      signer: createDataItemSigner(window.arweaveWallet),
    });

    const response = await result({
      message: messageId,
      process: agentProcessId,
    });

    if (response.Messages && response.Messages.length > 0) {
      const lastMessage = response.Messages[response.Messages.length - 1];

      // Check for success or error in tags
      const actionTag = lastMessage.Tags?.find(
        (tag: { name: string; value: string }) => tag.name === "Action"
      );

      if (
        actionTag?.value?.includes("Success") ||
        actionTag?.value?.includes("Queued")
      ) {
        console.log("Strategy execution successful");
        return;
      } else if (actionTag?.value?.includes("Error")) {
        const errorTag = lastMessage.Tags?.find(
          (tag: { name: string }) => tag.name === "Error"
        );
        throw new Error(errorTag?.value || "Strategy execution failed");
      }
    }

    throw new Error("No valid response received from agent");
  } catch (error) {
    console.error("Error executing agent strategy:", error);
    throw new Error("Failed to execute agent strategy");
  }
}
