import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { WalletProvider } from "./components/WalletProvider.tsx";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";
import { ConfigProvider } from "antd";
import { ChatbotProvider } from "./contexts/ChatbotContext.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EvmWalletProvider } from "./components/EvmWalletProvider.tsx";

// Create a React Query client
const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      {/* <EvmWalletProvider> */}
        <WalletProvider>
          <QueryClientProvider client={queryClient}>
            <ConfigProvider>
              <ChatbotProvider
                config={{ position: "bottom-right", theme: "auto" }}
              >
                <App />
              </ChatbotProvider>
            </ConfigProvider>
          </QueryClientProvider>
        </WalletProvider>
      {/* </EvmWalletProvider> */}
    </ThemeProvider>
  </StrictMode>
);
