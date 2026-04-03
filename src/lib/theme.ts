export const THEME_STORAGE_KEY = "theme";

export type AppTheme = "light" | "dark" | "night";

export const isAppTheme = (value: string): value is AppTheme =>
  value === "light" || value === "dark" || value === "night";

export const getStoredTheme = (): AppTheme => {
  const raw = localStorage.getItem(THEME_STORAGE_KEY) || "";
  if (isAppTheme(raw)) return raw;
  return "light";
};

export const applyThemeToDocument = (theme: AppTheme) => {
  const root = document.documentElement;
  root.classList.remove("dark", "theme-night");
  if (theme === "dark" || theme === "night") root.classList.add("dark");
  if (theme === "night") root.classList.add("theme-night");
  root.dataset.theme = theme;
};

export const cycleTheme = (theme: AppTheme): AppTheme => {
  if (theme === "light") return "dark";
  if (theme === "dark") return "night";
  return "light";
};

export const persistTheme = (theme: AppTheme) => {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent("app:theme-change", { detail: theme }));
};
