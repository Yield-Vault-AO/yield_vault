import { Button } from "@/components/ui/button";
import type { Strategy } from "./StrategyPreview";

interface DeploymentDetailsProps {
  strategy: Strategy;
  onDeploy: () => void;
  deploying: boolean;
  selectedChain: string;
}

export default function DeploymentDetails({
  strategy,
  onDeploy,
  deploying,
  selectedChain,
}: DeploymentDetailsProps) {
  return (
    <div className="rounded-2xl border border-[#EDFCFE0F] bg-[#070B0B] dark:bg-[#070B0B] px-4 sm:px-5 py-4 sm:py-5 space-y-4">
      <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] text-[#89A8AA]">
        Deployment Details
      </p>

      <div className="space-y-2 text-[13px] sm:text-[14px] text-[#E7FDFF] dark:text-[#E7FDFF]">
        <div className="flex items-center justify-between">
          <span className="text-[#89A8AA]">Input Token:</span>
          <span className="font-medium">{strategy.inputToken}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#89A8AA]">Risk Level:</span>
          <span className="font-medium">{strategy.riskLevel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#89A8AA]">Steps:</span>
          <span className="font-medium">{strategy.steps.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#89A8AA]">Network:</span>
          <span className="font-medium uppercase">{selectedChain}</span>
        </div>
      </div>

      <Button
        type="button"
        onClick={onDeploy}
        disabled={deploying}
        className="
          w-full mt-4
          text-xs sm:text-sm font-medium 
          text-[#090909] 
          bg-[#1FE9F7] hover:bg-[#1FE9F7]/80 
          rounded-lg 
          px-6 sm:px-10 py-3 sm:py-4 
          text-center cursor-pointer
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
        "
      >
        {deploying ? (
          <div className="flex items-center justify-center gap-2">
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#090909]"></span>
            Deploying to {selectedChain.toUpperCase()}...
          </div>
        ) : (
          `Deploy Strategy to ${selectedChain.toUpperCase()}`
        )}
      </Button>
    </div>
  );
}
