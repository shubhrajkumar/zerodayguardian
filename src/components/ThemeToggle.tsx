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

  return (
    <button
      aria-label="Toggle theme mode"
      title={`Theme: ${theme}`}
      className="p-2 rounded-md hover:bg-secondary/80 nav-pill"
      onClick={() => setTheme((prev) => cycleTheme(prev))}
    >
      {theme === "light" ? <Moon className="h-5 w-5" /> : theme === "dark" ? <Sun className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </button>
  );
};

export default ThemeToggle;
