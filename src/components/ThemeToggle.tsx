import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { applyThemeToDocument, AppTheme, cycleTheme, getStoredTheme, persistTheme } from "@/lib/theme";

const ThemeToggle = () => {
  const [theme, setTheme] = useState<AppTheme>(() => getStoredTheme());

  useEffect(() => {
    applyThemeToDocument(theme);
    document.documentElement.classList.add("theme-transition");
    const timer = window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
    }, 320);
    persistTheme(theme);
    return () => window.clearTimeout(timer);
  }, [theme]);

  const handleToggle = () => {
    setTheme((prev) => cycleTheme(prev));
  };

  const isLight = theme === "light";
  const nextLabel = theme === "light" ? "Dark" : theme === "dark" ? "Night" : "Light";

  return (
    <button
      aria-label={`Switch to ${nextLabel} mode`}
      title={`Theme: ${theme} - click for ${nextLabel}`}
      onClick={handleToggle}
      className="group relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 hover:bg-[var(--theme-overlay)] active:scale-95"
      style={{ color: "var(--theme-text-muted)" }}
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        <Sun
          className={`absolute h-[18px] w-[18px] transition-all duration-500 ${
            isLight
              ? "rotate-0 scale-100 opacity-100"
              : "rotate-90 scale-0 opacity-0"
          }`}
          style={{ color: isLight ? "#f59e0b" : "inherit" }}
        />
        <Moon
          className={`absolute h-[18px] w-[18px] transition-all duration-500 ${
            !isLight
              ? "rotate-0 scale-100 opacity-100"
              : "-rotate-90 scale-0 opacity-0"
          }`}
          style={{ color: !isLight ? "var(--theme-accent-blue)" : "inherit" }}
        />
      </span>
      <span className="hidden text-xs font-medium sm:inline transition-colors duration-200">
        {theme === "light" ? "Light" : theme === "dark" ? "Dark" : "Night"}
      </span>
      <span className="ml-0.5 hidden rounded-md border border-[var(--theme-border)] px-1.5 py-0.5 text-[10px] font-mono opacity-40 md:inline-block">
        {isLight ? "D" : "L"}
      </span>
    </button>
  );
};

export default ThemeToggle;
