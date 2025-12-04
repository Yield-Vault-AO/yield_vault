import { Button } from "@/components/ui/button";

export type Chain = {
  id: string;
  name: string;
  logo?: string;
};

// Default chains - can be extended
export const AVAILABLE_CHAINS: Chain[] = [
  { id: "ao", name: "AO", logo: "/ao_logo.svg" },
  { id: "Polygon", name: "Polygon", logo: "/polygon_logo.jpeg" },
  { id: "Flare", name: "Flare", logo: "/flare-flr-logo.png" },
  { id: "base", name: "Base", logo: "/base_logo.jpeg" },
];

interface ChainSelectorProps {
  selectedChain: string;
  onChainChange: (chainId: string) => void;
  chains?: Chain[];
}

export default function ChainSelector({
  selectedChain,
  onChainChange,
  chains = AVAILABLE_CHAINS,
}: ChainSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-xs sm:text-sm uppercase tracking-[0.18em] text-[#89A8AA] dark:text-[#89A8AA]">
        Deployment Network
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        {chains.map((chain) => {
          const isSelected = selectedChain === chain.id;
          return (
            <Button
              key={chain.id}
              type="button"
              variant={isSelected ? "default" : "outline"}
              onClick={() => onChainChange(chain.id)}
              className={`
                flex items-center justify-center space-x-2 px-4 py-6 rounded-xl transition-all duration-200
                ${
                  isSelected
                    ? "bg-gradient-to-br from-[#1fadd8] to-[#1a8bb8] text-white border-2 border-[#1fadd8] scale-105 shadow-lg"
                    : "bg-gradient-to-br from-white to-[#EAEAEA] dark:from-[#10181D] dark:to-[#121A21] text-[#565E64] dark:text-[#95A0A6] border border-[#EAEAEA] dark:border-[#192127] hover:scale-105 hover:border-[#1fadd8]"
                }
              `}
            >
              {chain.logo && (
                <img
                  src={chain.logo}
                  alt={chain.name}
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full ${chain.name == "Flare" ? "rounded-sm" : ""}`}
                  onError={(e) => {
                    // Hide image if it fails to load
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
              <span className="text-sm sm:text-base font-semibold">
                {chain.name}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
