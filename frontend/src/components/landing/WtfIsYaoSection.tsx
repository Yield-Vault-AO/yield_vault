import { useTheme } from "@/hooks/useTheme";
// import logo_white from "../../../public/yao_logo_white_new.svg";
// import logo from "../../../public/yao_logo_dark.svg";

const WtfIsYaoSection = () => {
  const { theme } = useTheme();

  return (
    <section className="relative z-10 md:mx-12 mx-4 px-4 md:px-6 py-12 md:py-16">
      <div className="grid lg:grid-cols-24 gap-8 md:gap-12 items-center">
        {/* Left side - Large WTF IS YAO text */}
        <div className="lg:col-span-5">
          <div
            className="text-4xl md:text-6xl font-bold text-[#1a2228] dark:text-[#D9D9D9] leading-tight"
            style={{
              textShadow: "2px 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            <div
              className="w-full justify-center flex md:flex-col items-center md:items-start md:w-[200px] font-black leading-tight md:leading-24 text-[48px] md:text-[88px] text-[#1A2228] dark:text-[#D9D9D9]"
              style={{
                fontFamily: "Poppins, sans-serif",
                lineHeight: "88px",
                ...(theme === "dark" && {
                  textShadow: `
                      -4px 4px 12px 0px rgba(78, 86, 92, 0.7),
                      4px -4px 8px 0px rgba(245, 251, 255, 1)
                    `,
                }),
              }}
            >
              <p>WTF</p>
              <p className="ml-4 mr-4 md:ml-10">IS</p>
              <p>YAO!</p>
            </div>
          </div>
        </div>

        {/* Middle - Descriptive text */}
        <div className="lg:col-span-10 space-y-4 text-center md:text-left md:space-y-6">
          <p className="text-[#565E64] dark:text-[#95A0A6] text-sm md:text-base leading-relaxed">
            YAO is a decentralized yield aggregator built to simplify earning in
            DeFi. We help users unlock the full potential of their crypto by
            routing funds through the most profitable, automated strategies
            across multiple protocols and chains.
          </p>
          <p className="text-[#565E64] dark:text-[#95A0A6] text-sm md:text-base pt-2 leading-relaxed">
            Our mission is to make yield farming effortless, secure, and
            accessible to everyone — from DeFi degens to curious newcomers. With
            a focus on optimization, transparency, and user-first design, YAO is
            your trusted partner for growing wealth in Web3.
          </p>
        </div>

        {/* Right side - Stylized logo */}
        <div className="lg:col-span-9 flex justify-end transform translate-x-0 md:translate-x-40">
          <div className="w-full h-[150px] md:w-[676px] md:h-[400px] text-sm md:text-base rounded-lg bg-gradient-to-br from-[#F5F5F4] to-[#F5F5F4] dark:from-[#0F181B] dark:to-[#0F181B] dark:text-[#1A2228] backdrop-blur-md dark:backdrop-blur-lg flex flex-col md:items-start items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg cursor-pointer p-4 md:px-8 md:py-12">
            {/* <img
              src={theme === "light" ? logo : logo_white}
              alt="YAO"
              className="w-[100px] h-[100px] md:w-[300px] md:h-[300px]"
            /> */}

            {theme === "light" ? (
              <video
                src="/video/white_yao_vid2.mp4"
                autoPlay
                loop
                muted
                className="w-[100px] h-[100px] md:w-[300px] md:h-[300px] bg-none border-none outline-none"
              ></video>
            ) : (
              <video
                src="/video/yao_vid2.mp4"
                autoPlay
                loop
                muted
                className="w-[100px] h-[100px] md:w-[300px] md:h-[300px] bg-transparent"
              ></video>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WtfIsYaoSection;
