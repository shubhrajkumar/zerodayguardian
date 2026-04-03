import React from "react";

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
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className={`min-h-[44px] px-4 py-2 rounded-md text-xs font-mono transition-colors w-full sm:w-auto text-left sm:text-center ${
            selected === opt
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
};

export default FilterBar;
