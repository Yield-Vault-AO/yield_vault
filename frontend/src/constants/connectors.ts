// Connector addresses and ActionType enum values for Polygon Amoy

// ActionType enum values (uint8)
// Based on IConnector.ActionType enum - these values may need to be confirmed from contract
export enum ActionType {
  SWAP = 0,
  // Add other action types as needed
  // LIQUIDITY_PROVISION = 1,
  // WITHDRAWAL = 2,
}

// Connector contract addresses for Polygon Amoy testnet
// These are placeholder addresses - update with actual connector contract addresses
export const CONNECTORS = {
  // Default swap connector - placeholder address
  SWAP: (import.meta.env.VITE_AMOY_SWAP_CONNECTOR || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  
  // Add other connector types as needed
  // LIQUIDITY: "0x..." as `0x${string}`,
} as const;

// Get connector address by action type
export function getConnectorAddress(actionType: ActionType): `0x${string}` {
  switch (actionType) {
    case ActionType.SWAP:
      return CONNECTORS.SWAP;
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}

