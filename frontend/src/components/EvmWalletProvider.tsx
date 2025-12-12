import { useState, type ReactNode } from "react";
import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider, http } from "wagmi";
import { mainnet, polygon, polygonAmoy, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

interface EvmWalletProviderProps {
  children: ReactNode;
}
const config = getDefaultConfig({
  appName: "Yield Vault",
  projectId: "b14efc134672a58cabe0320cf51267ec",
  chains: [sepolia, mainnet, polygon, polygonAmoy], // adjust to the chains you want
  transports: {
    [sepolia.id]: http(),
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [polygonAmoy.id]: http(),
  },
  ssr: true,
});

// const queryClient = new QueryClient();

export const EvmWalletProvider: React.FC<EvmWalletProviderProps> = ({
  children,
}) => {
    const [queryClient] = useState(() => new QueryClient());
    
return (
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
    <RainbowKitProvider>{children}</RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
)};