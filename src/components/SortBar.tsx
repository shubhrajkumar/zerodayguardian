import React from "react";

interface SortBarProps {
  options: { label: string; value: string }[];
  selected: string;
  onChange: (val: string) => void;
  ariaLabel?: string;
}

const SortBar: React.FC<SortBarProps> = ({
  options,
  selected,
  onChange,
  ariaLabel = "sort options",
}) => {
  return (
    <div className="flex flex-wrap gap-2 w-full sm:w-auto" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`min-h-[44px] px-4 py-2 rounded-md text-xs font-mono transition-colors w-full sm:w-auto text-left sm:text-center ${
            selected === opt.value
              ? "bg-accent text-accent-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export default SortBar;
