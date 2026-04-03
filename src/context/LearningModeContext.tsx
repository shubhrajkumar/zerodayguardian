import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type LearningMindset = "defense" | "offense";

type LearningModeContextValue = {
  mindset: LearningMindset;
  setMindset: (value: LearningMindset) => void;
  isDefense: boolean;
  isOffense: boolean;
  accentLabel: string;
};

const STORAGE_KEY = "zdg:learning-mindset";

const LearningModeContext = createContext<LearningModeContextValue | null>(null);

export const LearningModeProvider = ({ children }: { children: ReactNode }) => {
  const [mindset, setMindsetState] = useState<LearningMindset>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "offense" ? "offense" : "defense";
    } catch {
      return "defense";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mindset);
    } catch {
      // ignore storage issues
    }
  }, [mindset]);

  const value = useMemo(
    () => ({
      mindset,
      setMindset: setMindsetState,
      isDefense: mindset === "defense",
      isOffense: mindset === "offense",
      accentLabel: mindset === "defense" ? "Blue Team Mindset" : "Red Team Mindset",
    }),
    [mindset]
  );

  return <LearningModeContext.Provider value={value}>{children}</LearningModeContext.Provider>;
};

export const useLearningMode = () => {
  const context = useContext(LearningModeContext);
  if (!context) throw new Error("useLearningMode must be used within LearningModeProvider");
  return context;
};
