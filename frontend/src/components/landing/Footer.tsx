import { useTheme } from "@/hooks/useTheme";

const Footer = () => {
  const { theme } = useTheme();
  return (
    <footer className="relative z-10 bg-[#f6f5f2] dark:bg-[#11191F] border-t border-[#e6e6e6] dark:border-none dark:backdrop-blur-lg mt-12 md:mt-16">
      <div className="md:mx-12 mx-4 px-4 md:px-6 py-8 md:py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-8">
          <div className="md:col-span-1 flex flex-col items-center justify-center md:items-start md:justify-start">
            <h4 className="font-semibold text-[#1a2228] dark:text-white mb-2 md:mb-2.5 text-sm md:text-base">
              Community
            </h4>
            <div className=" flex items-center gap-2">
              <a
                href="https://x.com/yield_vaults"
                className=" bg-[#EBEBEBE5] dark:bg-[#161E24] rounded-lg p-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={"/new-twitter.svg"}
                  alt="twitter"
                  className="w-4 h-4 md:w-5 md:h-5"
                />
              </a>
              <a
                href="https://t.me/yield_vaults"
                className=" bg-[#EBEBEBE5] dark:bg-[#161E24] rounded-lg p-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={"/telegram.svg"}
                  alt="telegram"
                  className="w-4 h-4 md:w-5 md:h-5"
                />
              </a>
            </div>
          </div>

          <div className="md:col-span-1 flex flex-col items-center justify-center md:items-start md:justify-start">
            <h4 className="font-semibold text-[#1a2228] dark:text-white mb-3 md:mb-4 text-sm md:text-base">
              Product
            </h4>
            <div className="space-y-2 md:space-y-4">
              <a
                href="#"
                className="block text-[#565e64] dark:text-[#95A0A6] hover:text-[#1a2228] dark:hover:text-white text-xs md:text-sm"
              >
                Launch Dapp
              </a>
            </div>
          </div>

          <div className="md:col-span-1 flex flex-col items-center justify-center md:items-start md:justify-start">
            <h4 className="font-semibold text-[#1a2228] dark:text-white mb-3 md:mb-4 text-sm md:text-base">
              General
            </h4>
            <div className="space-y-2 md:space-y-4">
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[#565e64] dark:text-[#95A0A6] hover:text-[#1a2228] dark:hover:text-white text-xs md:text-sm"
              >
                Defi Spring
              </a>
              <a
                href="#"
                className="block text-[#565e64] dark:text-[#95A0A6] hover:text-[#1a2228] dark:hover:text-white text-xs md:text-sm"
              >
                Status Page
              </a>
            </div>
          </div>

          <div className="md:col-span-1 flex flex-col items-center justify-center md:items-start md:justify-start">
            <h4 className="font-semibold text-[#1a2228] dark:text-white mb-3 md:mb-4 text-sm md:text-base">
              Developers
            </h4>
            <div className="space-y-2 md:space-y-4">
              <a
                href="#"
                className="block text-[#565e64] dark:text-[#95A0A6] hover:text-[#1a2228] dark:hover:text-white text-xs md:text-sm"
              >
                Open Source
              </a>
              <a
                href="#"
                className="block text-[#565e64] dark:text-[#95A0A6] hover:text-[#1a2228] dark:hover:text-white text-xs md:text-sm"
              >
                White paper
              </a>
              <a
                href="https://github.com/Yield-Vault-AO/yield_vault"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[#565e64] dark:text-[#95A0A6] hover:text-[#1a2228] dark:hover:text-white text-xs md:text-sm"
              >
                GitHub
              </a>
            </div>
          </div>

          <div className="md:col-span-1 col-span-2 text-center md:text-right flex items-center justify-center md:justify-end">
            <img
              src={theme === "light" ? "/yao_logo.svg" : "/yao_logo_white.svg"}
              alt="YAO"
              className="w-[100px] h-[100px] md:w-[200px] md:h-[200px]"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mt-8 md:mt-12 pt-6 md:pt-8 border-t border-[#DAD9D9E5] dark:border-gray-700 space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <p className="text-[#7e868c] dark:text-[#95A0A6] text-xs md:text-sm">
              © 2024 YAO. All rights reserved.
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="#"
              className="text-[#7e868c] dark:text-gray-400 hover:text-[#1a2228] dark:hover:text-white text-xs md:text-sm"
            >
              Terms & Conditions
            </a>
            <a
              href="#"
              className="text-[#7e868c] dark:text-gray-400 hover:text-[#1a2228] dark:hover:text-white text-xs md:text-sm"
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
