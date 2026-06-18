import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// ── Storage keys ──
const ONBOARDING_DONE_KEY = "zdg_onboarding_done";
const ONBOARDING_OPERATOR_NAME_KEY = "zdg_operator_name";

interface OnboardingContextValue {
  /** Whether the onboarding ceremony should be shown */
  showCeremony: boolean;
  /** Whether the ceremony is currently playing */
  ceremonyActive: boolean;
  /** The operator's chosen callsign */
  operatorName: string;
  /** Start the ceremony (from auth flow) */
  initiateCeremony: () => void;
  /** Complete the ceremony */
  completeCeremony: (name: string) => void;
  /** Skip the ceremony */
  skipCeremony: () => void;
  /** Set the operator name during the ceremony */
  setOperatorName: (name: string) => void;
  /** Reset onboarding (for testing) */
  resetOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const isOnboardingDone = (): boolean => {
  try {
    return localStorage.getItem(ONBOARDING_DONE_KEY) === "true";
  } catch {
    return false;
  }
};

const getStoredName = (): string => {
  try {
    return localStorage.getItem(ONBOARDING_OPERATOR_NAME_KEY) || "";
  } catch {
    return "";
  }
};

interface OnboardingProviderProps {
  /** Does the user have zero progress? (new user detection) */
  isNewUser?: boolean;
  /** The user's email or name for the default callsign */
  defaultCallSign?: string;
  children: ReactNode;
}

export function OnboardingProvider({
  isNewUser = false,
  defaultCallSign = "",
  children,
}: OnboardingProviderProps) {
  const [showCeremony, setShowCeremony] = useState(false);
  const [ceremonyActive, setCeremonyActive] = useState(false);
  const [operatorName, setOperatorName] = useState(getStoredName() || defaultCallSign);
  const hasCheckedRef = useRef(false);

  // On mount, check if ceremony is needed
  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    if (isNewUser && !isOnboardingDone()) {
      // Don't auto-show — wait for initiateCeremony to be called
    }
  }, [isNewUser]);

  const initiateCeremony = useCallback(() => {
    if (isOnboardingDone()) return;
    setShowCeremony(true);
    setCeremonyActive(true);
  }, []);

  const completeCeremony = useCallback((name: string) => {
    const finalName = name.trim() || defaultCallSign || "Operator";
    try {
      localStorage.setItem(ONBOARDING_DONE_KEY, "true");
      if (finalName) localStorage.setItem(ONBOARDING_OPERATOR_NAME_KEY, finalName);
    } catch {
      // storage unavailable — continue without persisting
    }
    setOperatorName(finalName);
    setCeremonyActive(false);

    // Brief delay before hiding so exit animation plays
    setTimeout(() => {
      setShowCeremony(false);
    }, 500);
  }, [defaultCallSign]);

  const skipCeremony = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_DONE_KEY, "true");
    } catch {
      // storage unavailable
    }
    setCeremonyActive(false);
    setShowCeremony(false);
  }, []);

  const resetOnboarding = useCallback(() => {
    try {
      localStorage.removeItem(ONBOARDING_DONE_KEY);
      localStorage.removeItem(ONBOARDING_OPERATOR_NAME_KEY);
    } catch {
      // storage unavailable
    }
    setShowCeremony(false);
    setCeremonyActive(false);
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      showCeremony,
      ceremonyActive,
      operatorName,
      initiateCeremony,
      completeCeremony,
      skipCeremony,
      setOperatorName,
      resetOnboarding,
    }),
    [showCeremony, ceremonyActive, operatorName, initiateCeremony, completeCeremony, skipCeremony, setOperatorName, resetOnboarding]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return ctx;
}

export default OnboardingContext;
