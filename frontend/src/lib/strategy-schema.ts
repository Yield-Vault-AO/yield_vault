import { z } from "zod";

export const strategyStepSchema = z.object({
  action: z.string(),
  label: z.string(),
});

export const strategySchema = z.object({
  name: z.string(),
  summary: z.string(),
  inputToken: z.string(),
  riskLevel: z.string(),
  steps: z.array(strategyStepSchema),
});

export type StrategyFromSchema = z.infer<typeof strategySchema>;
export type StrategyStepFromSchema = z.infer<typeof strategyStepSchema>;

