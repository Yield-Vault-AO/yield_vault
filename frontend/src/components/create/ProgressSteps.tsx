import React from "react";

interface Step {
  label: string;
}

interface ProgressStepsProps {
  steps: Step[];
  currentIndex: number;
}

export default function ProgressSteps({
  steps,
  currentIndex,
}: ProgressStepsProps) {
  return (
    <div className="flex items-center justify-center w-full overflow-x-auto pb-2">
      <div className="flex items-center space-x-2 sm:space-x-4">
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={index}>
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center
                    text-xs sm:text-sm md:text-base font-semibold transition-all duration-300
                    ${
                      isActive
                        ? "bg-gradient-to-br from-[#1fadd8] to-[#1a8bb8] text-white scale-110 shadow-lg"
                        : isCompleted
                        ? "bg-gradient-to-br from-[#5CAB28] to-[#4a8f20] text-white"
                        : "bg-gradient-to-br from-white to-[#EAEAEA] dark:from-[#10181D] dark:to-[#121A21] text-[#7e868c] dark:text-[#95A0A6]"
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`
                    mt-2 text-xs sm:text-sm font-medium whitespace-nowrap
                    ${
                      isActive
                        ? "text-[#1fadd8] dark:text-[#30CFFF]"
                        : isCompleted
                        ? "text-[#5CAB28] dark:text-[#6CC832]"
                        : "text-[#7e868c] dark:text-[#95A0A6]"
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector Line */}
              {!isLast && (
                <div
                  className={`
                    h-0.5 w-12 sm:w-16 md:w-24 transition-all duration-300
                    ${
                      isCompleted
                        ? "bg-gradient-to-r from-[#5CAB28] to-[#4a8f20]"
                        : "bg-gradient-to-r from-[#EAEAEA] to-[#d0d0d0] dark:from-[#20282E] dark:to-[#192127]"
                    }
                  `}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
