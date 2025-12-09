import { useMutation } from "@tanstack/react-query";
import { generateStrategy, type GenerateStrategyParams } from "@/services/openrouterService";
import type { Strategy } from "@/components/create/StrategyPreview";

export function useStrategyGeneration() {
  return useMutation<Strategy, Error, GenerateStrategyParams>({
    mutationFn: generateStrategy,
  });
}

