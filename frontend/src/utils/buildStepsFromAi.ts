import type { Strategy } from "@/components/create/StrategyPreview";
import { TOKENS, type TokenKey } from "@/constants/polygonTokens";
import { ActionType, getConnectorAddress } from "@/constants/connectors";

// Contract Step structure matching the ABI
export interface ContractStep {
  readonly connector: `0x${string}`;
  readonly actionType: number; // uint8
  readonly assetsIn: readonly `0x${string}`[];
  readonly assetOut: `0x${string}`;
  readonly amountRatio: bigint; // uint256
  readonly data: `0x${string}`; // bytes
}

/**
 * Converts AI-generated strategy steps to contract Step format
 * @param strategy - The AI-generated strategy
 * @returns Array of contract Step structs
 */
export function buildStepsFromAi(strategy: Strategy): readonly ContractStep[] {
  const steps: ContractStep[] = [];
  
  // Get input token address
  const inputTokenKey = strategy.inputToken.toUpperCase() as TokenKey;
  const inputTokenAddress = TOKENS[inputTokenKey];
  
  if (!inputTokenAddress) {
    throw new Error(`Unsupported input token: ${strategy.inputToken}`);
  }

  // Track current token through the steps
  let currentTokenAddress = inputTokenAddress;
  let currentTokenKey = inputTokenKey;

  for (const step of strategy.steps) {
    const action = step.action.toUpperCase();
    
    if (action === "SWAP") {
      // Extract output token from label or infer from context
      // Label format might be like "Swap MATIC to USDC" or just "Swap to USDC"
      let outputTokenKey: TokenKey | null = null;
      
      if (step.label) {
        // Try to extract token symbol from label
        const labelUpper = step.label.toUpperCase();
        for (const tokenKey of Object.keys(TOKENS) as TokenKey[]) {
          if (labelUpper.includes(tokenKey)) {
            // Make sure it's not the current token
            if (tokenKey !== currentTokenKey) {
              outputTokenKey = tokenKey;
              break;
            }
          }
        }
      }
      
      // If we couldn't extract from label, try to infer from common swap patterns
      // For now, use a simple rotation or default to a different token
      if (!outputTokenKey) {
        // Default swap pattern: if input is MATIC, swap to USDC, otherwise swap to next common token
        const commonTokens: TokenKey[] = ["USDC", "USDT", "DAI", "WMATIC", "WETH"];
        outputTokenKey = commonTokens.find(t => t !== currentTokenKey) || "USDC";
      }
      
      const outputTokenAddress = TOKENS[outputTokenKey];
      
      if (!outputTokenAddress) {
        throw new Error(`Unsupported output token: ${outputTokenKey}`);
      }
      
      // Create swap step
      steps.push({
        connector: getConnectorAddress(ActionType.SWAP),
        actionType: ActionType.SWAP,
        assetsIn: [currentTokenAddress],
        assetOut: outputTokenAddress,
        amountRatio: 10000n, // 100% in basis points (10000 = 100%)
        data: "0x", // Empty bytes for simple swaps
      });
      
      // Update current token for next step
      currentTokenAddress = outputTokenAddress;
      currentTokenKey = outputTokenKey;
    } else {
      // Unknown action type - skip or throw error
      console.warn(`Unknown action type: ${action}, skipping step`);
    }
  }

  return steps;
}

