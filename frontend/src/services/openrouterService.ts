import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { strategySchema } from "@/lib/strategy-schema";

// Default model ID - can be overridden via env variable
const AI_MODEL_ID =
  import.meta.env.VITE_AI_MODEL_ID ?? "openai/gpt-4o-mini";

const SYSTEM_PROMPT = [
  "You generate DeFi strategies for the YAO dapp.",
    "All strategies MUST target the Polygon Amoy testnet using the Strategy module (definitions) and Engine contract (execution).",
    "You MUST NOT mention any other blockchain networks, testnets, or their native tokens including but not limited to: Flare, FLR, SFLR, FXRP, custom2 testnet, BNB Chain, BNB, WBNB, BUSD, Venus, Ethereum mainnet, or a StrategyVault contract anywhere in the response.",
    "You must output JSON only, matching the provided schema.",
    "Allowed inputToken symbols: MATIC, WMATIC, USDC, USDT, USDT0, DAI, WETH, WBTC, FLR, SFLR, FXRP.",
    "Allowed step actions: SWAP.",
    "For SWAP steps, outputToken must be one of: MATIC, WMATIC, USDC, USDT, USDT0, DAI, WETH, WBTC, FLR, SFLR, FXRP, and it must differ from the current token to avoid no-op swaps.",
    "If the user requests an unsupported token, map it to the closest allowed token and STILL produce a valid strategy. Never respond with an error strategy or 'unsupported token' message.",
    "Use no more than 10 steps, and each step must be a meaningful DeFi action on the allowed tokens.",
].join(" ");

export interface GenerateStrategyParams {
  prompt: string;
  chain?: string;
}

export async function generateStrategy({
  prompt,
}: GenerateStrategyParams) {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error("VITE_OPENROUTER_API_KEY is not configured");
  }

  try {
    // Create OpenRouter provider instance
    const openrouter = createOpenRouter({
      apiKey: apiKey,
    });

    // Create the language model from the provider
    const model = openrouter(AI_MODEL_ID);

    const { object } = await generateObject({
      model: model,
      schema: strategySchema,
      prompt: `${SYSTEM_PROMPT}\n\nUser request: ${prompt}`,
    });

    console.log("Generated object:", object);

    return strategySchema.parse(object);
  } catch (error: any) {
    // Extract detailed error information
    const errorMessage = error?.message || String(error);
    const errorCause = error?.cause;
    const errorResponse = error?.response || errorCause?.response;
    
    // Log detailed error information
    console.error("OpenRouter API Error Details:", {
      message: errorMessage,
      cause: errorCause,
      response: errorResponse,
      statusCode: errorResponse?.status || errorCause?.status,
      statusText: errorResponse?.statusText || errorCause?.statusText,
      data: errorResponse?.data || errorCause?.data,
      apiKeyPrefix: apiKey ? `${apiKey.substring(0, 15)}...` : "missing",
      apiKeyLength: apiKey?.length || 0,
      modelId: AI_MODEL_ID,
      fullError: error,
    });

    // Check for specific error types
    const statusCode = errorResponse?.status || errorCause?.status;
    const errorData = errorResponse?.data || errorCause?.data || {};
    const errorText = errorData?.error?.message || errorData?.message || errorMessage;

    if (statusCode === 401 || errorMessage?.includes("401") || errorMessage?.includes("Unauthorized")) {
      throw new Error("Invalid OpenRouter API key. Please check your VITE_OPENROUTER_API_KEY environment variable. Make sure it starts with 'sk-or-v1-'.");
    }
    
    if (statusCode === 404 || errorMessage?.includes("404") || errorMessage?.includes("Not Found")) {
      throw new Error(`Model "${AI_MODEL_ID}" not found. Please check the model ID is correct.`);
    }

    if (statusCode === 429 || errorMessage?.includes("429") || errorMessage?.includes("rate limit")) {
      throw new Error("OpenRouter API rate limit exceeded. Please try again later.");
    }

    // Provide the most detailed error message available
    const finalMessage = errorText || errorMessage || "Unknown error from OpenRouter API";
    throw new Error(`OpenRouter API error: ${finalMessage}`);
  }
}

