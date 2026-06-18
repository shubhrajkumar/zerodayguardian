import React from "react";
import { safeArray } from "@/utils/safeData";

interface FilterBarProps {
  options: string[];
  selected: string;
  onSelect: (opt: string) => void;
  ariaLabel?: string;
}

const FilterBar: React.FC<FilterBarProps> = ({
  options,
  selected,
  onSelect,
  ariaLabel = "filter options",
}) => {
  return (
    <div className="flex flex-wrap gap-2 w-full sm:w-auto" role="group" aria-label={ariaLabel}>
      {safeArray(options).map((opt) => {
        const isSelected = selected === opt;
        return (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`relative inline-flex min-h-[38px] items-center gap-2 rounded-md border px-4 py-2 font-mono text-xs font-medium uppercase tracking-[0.12em] transition-all duration-200 ${
              isSelected
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.06)]"
                : "border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-slate-300"
            }`}
          >
            {isSelected && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            )}
            {opt}
          </button>
        );
      })}
    </div>
  );
};

export default FilterBar;
