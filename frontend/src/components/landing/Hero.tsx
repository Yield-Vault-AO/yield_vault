import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { Link } from "react-router-dom";

interface DataPoint {
  id: number;
  x: number;
  y: number;
  color: string;
  value: number;
  active: boolean;
  apy: number;
}

const Hero = () => {
  const { theme } = useTheme();
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([
    {
      id: 1,
      x: 50,
      y: 200,
      color: "#d9d9d9",
      value: 100,
      active: false,
      apy: 8.5,
    },
    {
      id: 2,
      x: 100,
      y: 180,
      color: "#69c02f",
      value: 150,
      active: false,
      apy: 12.3,
    },
    {
      id: 3,
      x: 150,
      y: 160,
      color: "#1fadd8",
      value: 200,
      active: false,
      apy: 15.7,
    },
    {
      id: 4,
      x: 200,
      y: 140,
      color: "#fd3235",
      value: 80,
      active: false,
      apy: 6.2,
    },
    {
      id: 5,
      x: 250,
      y: 120,
      color: "#d9d9d9",
      value: 120,
      active: false,
      apy: 9.8,
    },
    {
      id: 6,
      x: 300,
      y: 100,
      color: "#fd3235",
      value: 90,
      active: false,
      apy: 7.4,
    },
    {
      id: 7,
      x: 350,
      y: 80,
      color: "#1fadd8",
      value: 180,
      active: false,
      apy: 14.1,
    },
  ]);

  const [botPosition, setBotPosition] = useState({ x: 50, y: 200 });
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const [totalValue, setTotalValue] = useState(920);

  useEffect(() => {
    const interval = setInterval(() => {
      // Find the point with highest APY
      const bestPoint = dataPoints.reduce((prev, current) =>
        prev.apy > current.apy ? prev : current
      );

      // Move bot towards best point
      setBotPosition({
        x: bestPoint.x,
        y: bestPoint.y,
      });

      // Set active point
      setActivePoint(bestPoint.id);

      // Update point states
      setDataPoints((prev) =>
        prev.map((point) => ({
          ...point,
          active: point.id === bestPoint.id,
          // Simulate APY changes
          apy: point.apy + (Math.random() - 0.5) * 1,
        }))
      );

      // Simulate value growth
      setTotalValue((prev) => prev + (Math.random() * 50 + 10));
    }, 2000);

    return () => clearInterval(interval);
  }, [dataPoints]);
  return (
    <section className="relative overflow-hidden md:mt-8 mt-5">
      {/* Grid background - visible on all screen sizes */}
      <div className="absolute right-0 -top-24 w-full md:w-2/3 h-full overflow-hidden">
        <img
          src="/grid.svg"
          alt="grid"
          className="w-ful h-[50%] md:h-full object-cover md:object-center opacity-40 md:opacity-45 dark:md:opacity-10 animate-float-grid"
        />
      </div>

      <div className="relative z-10 md:mx-12 mx-4 px-4 md:px-6 py-8 md:py-16">
        <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center min-h-[400px] md:min-h-[600px]">
          {/* Left side - Logo and content */}
          <div className="space-y-6 md:space-y-20 rounded-lg">
            <div className="space-y-4 md:space-y-6 mb-6 md:mb-10">
              <div className="flex flex-col text-center md:text-left md:flex-row items-center gap-4 md:gap-8">
                <div>
                  {theme === "light" ? (
                    <img
                      src="/YAO.svg"
                      alt="YAO"
                      // className="w-32 md:w-auto mb-2 md:mb-6"
                    />
                  ) : (
                    <img
                      src={"/yao_text_white.svg"}
                      alt="YAO"
                      // className="w-32 md:w-auto mb-2 md:mb-6"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-[#1A2228] dark:text-white text-sm md:text-base">
                    Find the best opportunities.
                  </p>
                  <p className="text-[#1A2228] dark:text-white text-sm md:text-base">
                    Maximize your crypto earnings.
                  </p>
                </div>
              </div>

              <Link
                to="/dashboard"
                className="h-12 md:h-14 w-full md:w-72 text-sm md:text-base rounded-lg bg-gradient-to-br from-[#4C545A] to-[#060E14] dark:bg-gradient-to-br dark:from-[#DAD9D9E5] dark:to-[#F8F7F4] dark:text-[#1A2228] backdrop-blur-md dark:backdrop-blur-lg text-white flex items-center font-semibold justify-center transition-all duration-200 hover:scale-105 shadow-lg cursor-pointer"
              >
                Launch Dapp
              </Link>
            </div>

            {/* Stats Section - Bottom cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-6 md:mt-16">
              <div className="text-sm md:text-base rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:bg-gradient-to-br dark:from-[#10181D] dark:to-[#121A21] dark:text-[#1A2228] backdrop-blur-md dark:backdrop-blur-lg flex flex-col items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg p-3 md:p-4">
                <p className="text-[#565E64] dark:text-[#95A0A6] text-xs md:text-sm mb-1 md:mb-2 text-center">
                  Total Value Locked (TVL)
                </p>
                <p className="text-[#1A2228] dark:text-[#F5FBFF] text-2xl md:text-4xl mt-1 md:mt-2 font-bold">
                  $77.40k
                </p>
              </div>

              <div className="text-sm md:text-base rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:bg-gradient-to-br dark:from-[#10181D] dark:to-[#121A21] dark:text-[#1A2228] backdrop-blur-md dark:backdrop-blur-lg flex flex-col items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg p-3 md:p-4">
                <p className="text-[#565E64] dark:text-[#95A0A6] text-xs md:text-sm mb-1 md:mb-2 text-center">
                  Total Rewards Generated
                </p>
                <p className="text-[#1A2228] dark:text-[#F5FBFF] text-2xl md:text-4xl mt-1 md:mt-2 font-bold">
                  $77.0k
                </p>
              </div>

              <div className="text-sm md:text-base rounded-lg bg-gradient-to-br from-white to-[#EAEAEA] dark:bg-gradient-to-br dark:from-[#10181D] dark:to-[#121A21] dark:text-[#1A2228] backdrop-blur-md dark:backdrop-blur-lg flex flex-col items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg p-3 md:p-4">
                <p className="text-[#565E64] dark:text-[#95A0A6] text-xs md:text-sm mb-1 md:mb-2 text-center">
                  Supported Pools
                </p>
                <p className="text-[#1A2228] dark:text-[#F5FBFF] text-2xl md:text-4xl mt-1 md:mt-2 font-bold">
                  40+
                </p>
              </div>
            </div>
          </div>

          {/* Right side - AI Optimization Animation */}
          <div className="relative h-[300px] md:h-[400px] flex items-center justify-center order-first md:order-last">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 400 300"
              className="absolute inset-0"
            >
              {/* Background line */}
              <path
                d="M 50 200 C 60 195 70 205 80 190 C 90 175 100 185 110 170 C 120 155 130 165 140 150 C 150 135 160 145 170 130 C 180 115 190 125 200 140 C 210 155 220 145 230 130 C 240 115 250 125 260 110 C 270 95 280 105 290 90 C 300 75 310 85 320 70 C 330 55 340 65 350 80"
                fill="none"
                stroke="#d9d9d9"
                strokeWidth="2"
                opacity="0.3"
                className="dark:stroke-gray-600"
              />

              {/* Connection lines to active point */}
              {dataPoints.map((point) => (
                <g key={`line-${point.id}`}>
                  <line
                    x1={botPosition.x}
                    y1={botPosition.y}
                    x2={point.x}
                    y2={point.y}
                    stroke={
                      point.active
                        ? "rgba(26, 34, 40, 0.8)"
                        : "rgba(26, 34, 40, 0.2)"
                    }
                    strokeWidth={point.active ? "2" : "1"}
                    className={`${
                      point.active ? "animate-pulse" : ""
                    } dark:stroke-white/60`}
                  />

                  {/* Data flow animation */}
                  {point.active && (
                    <circle r="3" fill="rgba(26, 34, 40, 0.6)">
                      <animateMotion
                        dur="2s"
                        repeatCount="indefinite"
                        path={`M${botPosition.x},${botPosition.y} L${point.x},${point.y}`}
                      />
                    </circle>
                  )}
                </g>
              ))}

              {/* Data points */}
              {dataPoints.map((point) => (
                <g key={point.id}>
                  {/* Glow effect for active point */}
                  {point.active && (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="12"
                      fill="transparent"
                      stroke={point.color}
                      strokeWidth="2"
                      opacity="0.6"
                      className="animate-pulse"
                    />
                  )}

                  {/* Background circle */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="8"
                    fill="white"
                    stroke="#d989d9"
                    strokeWidth="1"
                  />

                  {/* Main circle */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="5"
                    fill={point.color}
                    className={point.active ? "animate-pulse" : ""}
                  />

                  {/* APY indicator */}
                  <text
                    x={point.x}
                    y={point.y - 15}
                    textAnchor="middle"
                    fontSize="12"
                    fill={point.active ? "#1a2228" : "#7E868C"}
                    className="font-mono"
                  >
                    {point.apy.toFixed(1)}%
                  </text>
                </g>
              ))}

              {/* AI Bot */}
              <g>
                <circle
                  cx={botPosition.x}
                  cy={botPosition.y}
                  r="8"
                  fill="rgba(26, 34, 40, 0.1)"
                  stroke="rgba(26, 34, 40, 0.5)"
                  strokeWidth="1"
                  className="animate-pulse"
                />

                {/* Bot center */}
                <circle
                  cx={botPosition.x}
                  cy={botPosition.y}
                  r="4"
                  fill="rgba(26, 34, 40, 0.3)"
                />

                {/* Bot "eyes" */}
                <circle
                  cx={botPosition.x - 2}
                  cy={botPosition.y - 1}
                  r="1"
                  fill="rgba(26, 34, 40, 0.8)"
                />
                <circle
                  cx={botPosition.x + 2}
                  cy={botPosition.y - 1}
                  r="1"
                  fill="rgba(26, 34, 40, 0.8)"
                />

                {/* Bot label */}
                <text
                  x={botPosition.x}
                  y={botPosition.y - 25}
                  textAnchor="middle"
                  fontSize="14"
                  fill={theme === "light" ? "#1a2228" : "#F5FBFF"}
                  className="font-mono font-semibold"
                >
                  YAO AI
                </text>
              </g>

              {/* Info display */}
              <g>
                <rect
                  x="240"
                  y="210"
                  width="140"
                  height="50"
                  rx="4"
                  fill="rgba(255,255,255,0.9)"
                  stroke="rgba(26, 34, 40, 0.2)"
                  strokeWidth="1"
                />

                <text
                  x="310"
                  y="235"
                  textAnchor="middle"
                  fontSize="12"
                  fill="#1a2228"
                  className="font-mono"
                >
                  Optimizing ${totalValue.toFixed(0)}k
                </text>

                <text
                  x="310"
                  y="250"
                  textAnchor="middle"
                  fontSize="10"
                  fill="#7E868C"
                  className="font-mono"
                >
                  Target: Point {activePoint || "-"}
                </text>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
