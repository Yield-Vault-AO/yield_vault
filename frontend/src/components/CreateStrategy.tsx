import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ProgressSteps from "./create/ProgressSteps";
import PromptInput from "./create/PromptInput";
import ChainSelector, { AVAILABLE_CHAINS } from "./create/ChainSelector";
import StrategyPreview, { type Strategy } from "./create/StrategyPreview";
import DeploymentDetails from "./create/DeploymentDetails";
import toast from "react-hot-toast";
import { useStrategyGeneration } from "@/hooks/useStrategyGeneration";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { decodeEventLog } from "viem";
import { STRATEGY_CONTRACT_ABI } from "@/abis/strategyContract";
import { AMOY_STRATEGY_CONTRACT } from "@/constants/amoy_contract";
import { TOKENS, type TokenKey } from "@/constants/polygonTokens";
import { buildStepsFromAi } from "@/utils/buildStepsFromAi";

const STEPS = [
  { label: "Prompt" },
  { label: "AI Strategy" },
  { label: "Deploy" },
];

export default function CreateStrategy() {
  const navigate = useNavigate();
  const strategyMutation = useStrategyGeneration();
  
  // Wagmi hooks for EVM wallet and contract interaction
  const { isConnected, address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [prompt, setPrompt] = useState("");
  const [selectedChain, setSelectedChain] = useState(AVAILABLE_CHAINS[0].id);
  const [aiStrategy, setAiStrategy] = useState<Strategy | null>(null);
  const [deploying, setDeploying] = useState(false);

  const generating = strategyMutation.isPending;
  const hasStrategy = !!aiStrategy;
  const currentStep = hasStrategy ? 2 : prompt ? 1 : 0;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a strategy description");
      return;
    }

    setAiStrategy(null);

    strategyMutation.mutate(
      { prompt, chain: selectedChain },
      {
        onSuccess: (strategy) => {
          setAiStrategy(strategy);
          toast.success("Strategy generated successfully!");
        },
        onError: (error) => {
          const message =
            error instanceof Error ? error.message : "Failed to generate strategy";
          toast.error(message);
          console.error("Strategy generation error:", error);
        },
      }
    );
  };

  const handleDeploy = async () => {
    if (!aiStrategy) return;

    // Validate token
    const tokenKey = aiStrategy.inputToken.toUpperCase() as TokenKey;
    const token = TOKENS[tokenKey];

    if (!token) {
      toast.error("AI returned an unsupported input token. Try again.");
      return;
    }

    // Validate wallet connection
    if (!isConnected || !address) {
      toast.error("Connect your wallet on Polygon Amoy testnet to deploy the strategy.");
      return;
    }

    // Only deploy to Polygon for now
    if (selectedChain !== "Polygon") {
      toast.error("Polygon deployment is currently only supported. Please select Polygon.");
      return;
    }

    setDeploying(true);

    try {
      // Build steps from AI strategy
      const steps = buildStepsFromAi(aiStrategy);

      // Write contract transaction
      const hash = await writeContractAsync({
        abi: STRATEGY_CONTRACT_ABI,
        address: AMOY_STRATEGY_CONTRACT,
        functionName: "createStrategy",
        args: [
          aiStrategy.name,
          aiStrategy.summary,
          steps as any, // Type assertion needed due to wagmi's strict ABI type inference
          BigInt(0), // minDeposit
        ],
      });

      if (!publicClient) {
        throw new Error("Public client not available");
      }

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "reverted") {
        toast.error("Failed to deploy strategy. Transaction was reverted.");
        return;
      }

      // Decode CreateStrategy event to get strategyId
      let strategyId: `0x${string}` | null = null;

      for (const log of receipt.logs) {
        if (
          log.address.toLowerCase() !== AMOY_STRATEGY_CONTRACT.toLowerCase()
        ) {
          continue;
        }

        try {
          const decoded = decodeEventLog({
            abi: STRATEGY_CONTRACT_ABI,
            data: log.data,
            topics: log.topics,
          });

          if (decoded.eventName === "CreateStrategy") {
            const args = decoded.args as unknown as {
              strategyId?: `0x${string}`;
            };
            if (args?.strategyId) {
              strategyId = args.strategyId;
              break;
            }
          }
        } catch {
          // Ignore non-matching logs
        }
      }

      if (strategyId != null) {
        // Try to save strategy metadata via API (optional)
        try {
          const res = await fetch("/api/strategies/create-from-ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              strategyId,
              prompt,
              strategy: aiStrategy,
            }),
          });

          if (!res.ok) {
            console.warn("Failed to save strategy metadata, but deployment succeeded");
          }
        } catch (apiError) {
          // API call is optional - don't fail deployment if it fails
          console.warn("API call failed, but deployment succeeded:", apiError);
        }

        toast.success("Strategy deployed successfully!");
        navigate(`/strategy/${strategyId}`);
      } else {
        toast.error("Strategy deployed but could not extract strategy ID.");
        navigate("/dashboard");
      }
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      console.error("Deployment error:", error);
      
      // Provide user-friendly error messages
      if (errorMessage.includes("User rejected") || errorMessage.includes("user rejected")) {
        toast.error("Transaction was rejected. Please try again.");
      } else if (errorMessage.includes("insufficient funds")) {
        toast.error("Insufficient funds for transaction.");
      } else {
        toast.error(`Failed to deploy strategy: ${errorMessage}`);
      }
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f7f4] dark:bg-[#0F1419]">
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 lg:px-12 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:gap-6 lg:flex-row lg:justify-between lg:items-start">
          <div>
            <h1 className="text-[28px] sm:text-[32px] lg:text-4xl font-semibold text-[#1A2228] dark:text-[#E7FDFF]">
              Create New Strategy
            </h1>
            <p className="mt-3 sm:mt-4 text-[14px] sm:text-[16px] text-[#565E64] dark:text-[#88AEB1]">
              Describe the strategy you want. Yao will turn it into executable
              steps on your selected network.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="
                rounded-full border border-[#EAEAEA] dark:border-[#1FE9F7]/30 
                bg-white dark:bg-[#090909] 
                px-6 sm:px-8 lg:px-12 py-4 sm:py-5 
                text-xs sm:text-sm font-semibold 
                text-[#565E64] dark:text-[#88AEB1]
                transition hover:bg-[#f5f5f5] dark:hover:text-[#E2FEFF] 
                cursor-pointer
              "
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="
                rounded-full border border-[#EAEAEA] dark:border-[#1FE9F7]/30 
                bg-white dark:bg-[#090909] 
                px-6 sm:px-8 lg:px-12 py-4 sm:py-5 
                text-xs sm:text-sm font-semibold 
                text-[#565E64] dark:text-[#1FE9F7]
                transition hover:bg-[#f5f5f5] dark:hover:text-[#E2FEFF] 
                cursor-not-allowed opacity-50
              "
              disabled
            >
              Save Draft (coming soon)
            </Button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 sm:mb-12">
          <ProgressSteps steps={STEPS} currentIndex={currentStep} />
        </div>

        {/* Main Content */}
        <section className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white to-[#EAEAEA] dark:from-[#10181D] dark:to-[#121A21] p-4 sm:p-6 lg:p-8 shadow-[0_8px_20px_rgba(0,0,0,0.2)] backdrop-blur-sm">
          <h2 className="mb-6 sm:mb-8 text-xs sm:text-sm text-center font-semibold uppercase tracking-[0.18em] text-[#1A2228] dark:text-[#F2F4F5]">
            Tell Yao what you want to build
          </h2>

          {/* Prompt Input */}
          <div className="mb-6">
            <PromptInput value={prompt} onChange={setPrompt} />
          </div>

          {/* Chain Selector */}
          <div className="mb-6">
            <ChainSelector
              selectedChain={selectedChain}
              onChainChange={setSelectedChain}
            />
          </div>

          {/* Generate Button */}
          <div className="mt-6 sm:mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[12px] sm:text-[13px] text-[#565E64] dark:text-[#88AEB1]">
              {generating ? (
                <span>
                  Computing contract inputs and strategy steps for{" "}
                  {selectedChain.toUpperCase()}...
                </span>
              ) : (
                <span>
                  Yao will infer tokens, protocols, and steps based on your
                  description.
                </span>
              )}
            </div>

            <Button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="
                text-xs sm:text-sm font-medium 
                text-[#090909] 
                bg-[#1FE9F7] hover:bg-[#1FE9F7]/80 
                rounded-lg 
                px-8 sm:px-12 lg:px-16 py-4 sm:py-5 lg:py-6 
                text-center cursor-pointer
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                w-full sm:w-auto
              "
            >
              {generating ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#090909]"></span>
                  Generating...
                </div>
              ) : (
                "Generate with AI"
              )}
            </Button>
          </div>

          {/* Strategy Preview & Deployment */}
          {aiStrategy && (
            <div className="mt-8 sm:mt-10 grid gap-6 sm:gap-8 md:grid-cols-[1.4fr_minmax(0,1fr)] items-start">
              {/* Strategy Preview */}
              <div>
                <StrategyPreview strategy={aiStrategy} />
              </div>

              {/* Deployment Details */}
              <div>
                <DeploymentDetails
                  strategy={aiStrategy}
                  onDeploy={handleDeploy}
                  deploying={deploying}
                  selectedChain={selectedChain}
                />
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
