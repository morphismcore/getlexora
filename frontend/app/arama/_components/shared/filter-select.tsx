"use client";

export function FilterSelect({
  value,
  onChange,
  options,
  prefix,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[] | string[];
  prefix: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-[#16161A] border border-white/[0.06] rounded-xl px-3 py-2.5 pr-8 text-[12px] text-[#8B8B8E] focus:outline-none focus:border-[#6C6CFF]/40 focus:bg-[#1A1A1F] transition-all cursor-pointer"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "Tümü" ? `${prefix}: Tümü` : o}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5C5C5F] pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          d="M6 9l6 6 6-6"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
