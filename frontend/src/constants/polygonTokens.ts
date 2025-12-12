// Polygon Amoy testnet token addresses
// These are placeholder addresses - update with actual testnet addresses

export type TokenKey =
  | "MATIC"
  | "WMATIC"
  | "USDC"
  | "USDT"
  | "USDT0"
  | "DAI"
  | "WETH"
  | "WBTC"
  | "FLR"
  | "SFLR"
  | "FXRP";

export const TOKENS: Record<TokenKey, `0x${string}`> = {
  // Native MATIC (using zero address as placeholder - actual implementation may differ)
  MATIC: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  
  // Wrapped MATIC - placeholder address
  WMATIC: (import.meta.env.VITE_AMOY_WMATIC || "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889") as `0x${string}`,
  
  // USDC - placeholder address
  USDC: (import.meta.env.VITE_AMOY_USDC || "0x41E94Eb019C0762f9Bf3289d6D7fAA6aC0be1B5C") as `0x${string}`,
  
  // USDT - placeholder address
  USDT: (import.meta.env.VITE_AMOY_USDT || "0x41E94Eb019C0762f9Bf3289d6D7fAA6aC0be1B5C") as `0x${string}`,
  
  // USDT0 - placeholder address
  USDT0: (import.meta.env.VITE_AMOY_USDT0 || "0x41E94Eb019C0762f9Bf3289d6D7fAA6aC0be1B5C") as `0x${string}`,
  
  // DAI - placeholder address
  DAI: (import.meta.env.VITE_AMOY_DAI || "0x41E94Eb019C0762f9Bf3289d6D7fAA6aC0be1B5C") as `0x${string}`,
  
  // WETH - placeholder address
  WETH: (import.meta.env.VITE_AMOY_WETH || "0x41E94Eb019C0762f9Bf3289d6D7fAA6aC0be1B5C") as `0x${string}`,
  
  // WBTC - placeholder address
  WBTC: (import.meta.env.VITE_AMOY_WBTC || "0x41E94Eb019C0762f9Bf3289d6D7fAA6aC0be1B5C") as `0x${string}`,
  
  // FLR - placeholder address
  FLR: (import.meta.env.VITE_AMOY_FLR || "0x41E94Eb019C0762f9Bf3289d6D7fAA6aC0be1B5C") as `0x${string}`,
  
  // SFLR - placeholder address
  SFLR: (import.meta.env.VITE_AMOY_SFLR || "0x41E94Eb019C0762f9Bf3289d6D7fAA6aC0be1B5C") as `0x${string}`,
  
  // FXRP - placeholder address
  FXRP: (import.meta.env.VITE_AMOY_FXRP || "0x41E94Eb019C0762f9Bf3289d6D7fAA6aC0be1B5C") as `0x${string}`,
};

