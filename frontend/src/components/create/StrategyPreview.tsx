export interface StrategyStep {
  action: string;
  label?: string;
}

export interface Strategy {
  name: string;
  summary: string;
  inputToken: string;
  riskLevel: string;
  steps: StrategyStep[];
}

interface StrategyPreviewProps {
  strategy: Strategy;
}

export default function StrategyPreview({ strategy }: StrategyPreviewProps) {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Strategy Header */}
      <div className="space-y-3 sm:space-y-4">
        <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] text-[#89A8AA]">
          AI Strategy Preview
        </p>
        <h3 className="text-[18px] sm:text-[20px] lg:text-[24px] font-semibold text-[#F2F4F5] dark:text-[#F2F4F5]">
          {strategy.name}
        </h3>
        <p className="text-[13px] sm:text-[14px] lg:text-[15px] leading-6 sm:leading-7 text-[#CDEFF1] dark:text-[#CDEFF1]">
          {strategy.summary}
        </p>
      </div>

      {/* Execution Steps */}
      <div className="space-y-3">
        <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] text-[#89A8AA] dark:text-[#89A8AA]">
          Execution Steps
        </p>
        <ol className="space-y-2 text-[13px] sm:text-[14px] text-[#F2F4F5] dark:text-[#F2F4F5]">
          {strategy.steps.map((step, index) => (
            <li key={index} className="flex items-start">
              <span className="text-[#89A8AA] mr-3 font-medium min-w-[24px]">
                {index + 1}.
              </span>
              <div className="flex-1">
                <span className="uppercase text-[11px] tracking-[0.16em] text-[#5efbff] mr-2 font-semibold">
                  {step.action}
                </span>
                <span className="text-[#CDEFF1]">
                  {step.label ?? "Generated step"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
