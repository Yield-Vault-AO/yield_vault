interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}

export default function PromptInput({
  value,
  onChange,
  placeholder = "E.g. A medium-risk looping strategy using WBNB as input, swapping into USDT then supplying to Venus, with auto-withdraw to BUSD when markets are volatile.",
  maxLength = 1000,
}: PromptInputProps) {
  const remainingChars = maxLength - value.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs sm:text-sm uppercase tracking-[0.18em] text-[#89A8AA] dark:text-[#89A8AA]">
          Strategy Idea (Prompt)
        </label>
        <span
          className={`text-xs ${
            remainingChars < 100
              ? "text-red-500"
              : "text-[#7e868c] dark:text-[#95A0A6]"
          }`}
        >
          {remainingChars} characters remaining
        </span>
      </div>
      <textarea
        rows={6}
        maxLength={maxLength}
        className="
          w-full rounded-xl sm:rounded-2xl 
          border border-[#1FE9F7] 
          bg-[#EDFCFE0F] 
          px-4 sm:px-5 py-3 sm:py-4 
          text-[14px] sm:text-[15px] 
          text-[#000000]/80 dark:text-[#CDEFF1]
          placeholder:text-[#597778] 
          focus:border-[#1FE9F7] focus:outline-none focus:ring-1 focus:ring-[#1FE9F7]
          resize-none
          transition-all duration-200
        "
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
