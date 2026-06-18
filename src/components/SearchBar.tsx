import React from "react";

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = "Search...",
  ariaLabel = "search",
}) => {
  return (
    <div className="relative w-full" role="search">
      {/* Command-line prompt icon */}
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-emerald-400">
        {">_"}
      </span>
      <input
        type="search"
        aria-label={ariaLabel}
        placeholder={placeholder}
        className="w-full min-h-[44px] rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-10 pr-4 font-mono text-sm text-slate-100 placeholder-slate-500 transition-all duration-200 focus:border-cyan-500/50 focus:shadow-[0_0_12px_rgba(34,211,238,0.08)] focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

export default SearchBar;
