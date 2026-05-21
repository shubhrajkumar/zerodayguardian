import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        aria-label={ariaLabel}
        placeholder={placeholder}
        className="pl-10 bg-secondary border-primary/20 w-full min-h-[44px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

export default SearchBar;
