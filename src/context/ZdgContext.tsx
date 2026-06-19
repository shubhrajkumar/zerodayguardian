/**
 * ZdgContext — Global Security Context with localStorage persistence.
 *
 * Manages:
 *   - Operator profile (handle, email, rank, XP, streak)
 *   - Persistent localStorage session (survives page refresh)
 *   - Daily streak calculation (resets after 24h idle)
 *   - Mock JWT token generation for offline/local auth
 *   - Login / Signup / Logout flows
 *
 * Integrates with the existing gamification localStorage keys so
 * XP and streak data stay consistent across contexts.
 */
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ── Constants ──

const OPERATOR_STORAGE_KEY = "zdg:operator";
const GAMIFICATION_PREFIX = "zdg:gamification";
const TOKEN_STORAGE_KEY = "zdg:token";
const MOCK_JWT_PREFIX = "zdg_mock_jwt_";

// ── Types ──

export type OperatorRank =
  | "Recruit"
  | "Operator"
  | "Analyst"
  | "Hunter"
  | "Specialist"
  | "Guardian"
  | "Elite Guardian";

export type ZdgOperator = {
  handle: string;
  email: string;
  rank: OperatorRank;
  xp: number;
  streak: number;
  lastLogin: number;
  createdAt: number;
  completedLabs: string[];
};

export type ZdgContextValue = {
  /** The current operator profile, or null if signed out */
  user: ZdgOperator | null;
  /** Current total XP (sourced from operator + gamification localStorage) */
  globalXp: number;
  /** Current streak count (calculated from lastLogin vs now) */
  streakCount: number;
  /** Array of completed lab IDs */
  completedLabs: string[];
  /** Whether a user is currently signed in */
  isAuthenticated: boolean;
  /** Whether the context is still initializing from localStorage */
  isLoading: boolean;
  /** Sign in with email + password. Creates/loads operator profile. */
  login: (email: string, password?: string) => Promise<void>;
  /** Sign up with email, password, and handle. Creates new operator profile. */
  signup: (email: string, password: string, handle: string) => Promise<void>;
  /** Sign out and clear all local session data. */
  logout: () => Promise<void>;
  /** Add XP to the operator's total and persist. */
  addXp: (amount: number) => void;
  /** Mark a lab as completed and persist. */
  completeLab: (labId: string) => void;
  /** Force a refresh of XP/streak from gamification storage. */
  syncFromGamification: () => void;
};

const ZDG_CONTEXT_EMPTY: ZdgContextValue = {
  user: null,
  globalXp: 0,
  streakCount: 0,
  completedLabs: [],
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  addXp: () => {},
  completeLab: () => {},
  syncFromGamification: () => {},
};

const ZdgContext = createContext<ZdgContextValue>(ZDG_CONTEXT_EMPTY);

// ── Utilities ──

const generateMockJwt = (handle: string): string => {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      sub: handle,
      handle,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
      iss: "zdg-local-auth",
    })
  );
  const signature = btoa(`${handle}:${Date.now()}:zdg_local`);
  return `${header}.${payload}.${signature}`;
};

const calculateOperatorRank = (xp: number): OperatorRank => {
  if (xp >= 20000) return "Elite Guardian";
  if (xp >= 12000) return "Guardian";
  if (xp >= 7000) return "Specialist";
  if (xp >= 3000) return "Hunter";
  if (xp >= 1000) return "Analyst";
  if (xp >= 200) return "Operator";
  return "Recruit";
};

const calculateStreak = (lastLogin: number, currentStreak: number): number => {
  const now = Date.now();
  const elapsed = now - lastLogin;
  const TWO_DAYS_MS = 48 * 60 * 60 * 1000;
  // If within 48h of last login, increment the streak
  if (elapsed < TWO_DAYS_MS) return currentStreak + 1;
  // More than 48h: reset to 1
  return 1;
};

const loadOperator = (): ZdgOperator | null => {
  try {
    const raw = localStorage.getItem(OPERATOR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ZdgOperator;
    // Validate minimum required fields
    if (!parsed.handle || !parsed.email) return null;
    // Calculate fresh streak based on lastLogin
    const streak = calculateStreak(parsed.lastLogin, parsed.streak);
    return { ...parsed, streak };
  } catch {
    return null;
  }
};

const saveOperator = (operator: ZdgOperator): void => {
  try {
    localStorage.setItem(OPERATOR_STORAGE_KEY, JSON.stringify(operator));
  } catch {
    // localStorage unavailable — carry on
  }
};

const clearOperator = (): void => {
  try {
    localStorage.removeItem(OPERATOR_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem("zdg_token");
    localStorage.removeItem("zdg_refresh");
  } catch {
    // ignore
  }
};

const readGamificationXp = (userId: string): number => {
  try {
    const raw = localStorage.getItem(`${GAMIFICATION_PREFIX}:${userId}`);
    if (!raw) return 0;
    const data = JSON.parse(raw);
    return Number(data.totalXp || 0);
  } catch {
    return 0;
  }
};

const readGamificationStreak = (userId: string): number => {
  try {
    const raw = localStorage.getItem(`${GAMIFICATION_PREFIX}:${userId}`);
    if (!raw) return 0;
    const data = JSON.parse(raw);
    return Number(data.streakDays || 0);
  } catch {
    return 0;
  }
};

const readGamificationCompletedLabs = (userId: string): string[] => {
  try {
    const raw = localStorage.getItem(`${GAMIFICATION_PREFIX}:${userId}`);
    if (!raw) return [];
    const data = JSON.parse(raw);
    // Check common field names for completed labs
    const labs = data.completedLabs || data.completedDays || [];
    return Array.isArray(labs) ? labs.map(String) : [];
  } catch {
    return [];
  }
};

// ── Provider ──

export const ZdgProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<ZdgOperator | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [globalXp, setGlobalXp] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [completedLabs, setCompletedLabs] = useState<string[]>([]);
  const initRef = useRef(false);
  const gamificationSyncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncFromGamification = useCallback(() => {
    setUser((current) => {
      if (!current) return current;
      const xp = readGamificationXp(current.handle);
      const streak = readGamificationStreak(current.handle);
      const labs = readGamificationCompletedLabs(current.handle);
      setGlobalXp(xp > 0 ? xp : current.xp);
      setStreakCount(streak > 0 ? streak : current.streak);
      setCompletedLabs(labs.length > 0 ? labs : current.completedLabs);
      return current;
    });
  }, []);

  // ── Init: load operator from localStorage ──
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const operator = loadOperator();
    if (operator) {
      setUser(operator);
      setStreakCount(operator.streak);
      setGlobalXp(operator.xp);
      setCompletedLabs(operator.completedLabs);

      // Try to read richer data from gamification storage
      const gXp = readGamificationXp(operator.handle);
      const gStreak = readGamificationStreak(operator.handle);
      const gLabs = readGamificationCompletedLabs(operator.handle);
      if (gXp > 0) setGlobalXp(gXp);
      if (gStreak > 0) setStreakCount(gStreak);
      if (gLabs.length > 0) setCompletedLabs(gLabs);
    }

    setIsLoading(false);
  }, []);

  // ── Periodic gamification sync (every 10s) ──
  useEffect(() => {
    if (!user) return;
    gamificationSyncTimerRef.current = setInterval(syncFromGamification, 30_000);
    return () => {
      if (gamificationSyncTimerRef.current) {
        clearInterval(gamificationSyncTimerRef.current);
      }
    };
  }, [user, syncFromGamification]);

  // ── Login: authenticate with email/password, store operator to localStorage ──
  const login = useCallback(async (email: string, _password?: string) => {
    const handle = email.split("@")[0].replace(/[^a-zA-Z0-9_-]/g, "_");
    const now = Date.now();

    // Try to load existing operator for this handle
    const existing = loadOperator();

    const operator: ZdgOperator = existing && existing.email === email
      ? {
          ...existing,
          lastLogin: now,
          streak: calculateStreak(existing.lastLogin, existing.streak),
        }
      : {
          handle,
          email,
          rank: "Recruit",
          xp: 0,
          streak: 1,
          lastLogin: now,
          createdAt: now,
          completedLabs: [],
        };

    // Generate and store mock JWT
    const token = generateMockJwt(operator.handle);
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem("zdg_token", token);
      localStorage.setItem("zdg_mock_auth", "true");
    } catch {
      // ignore
    }

    saveOperator(operator);
    setUser(operator);
    setGlobalXp(operator.xp);
    setStreakCount(operator.streak);
    setCompletedLabs(operator.completedLabs);
  }, []);

  // ── Signup: create new operator profile ──
  const signup = useCallback(async (email: string, _password: string, handle: string) => {
    const now = Date.now();
    const sanitizedHandle = handle.replace(/[^a-zA-Z0-9_-]/g, "_") || email.split("@")[0];

    const operator: ZdgOperator = {
      handle: sanitizedHandle,
      email,
      rank: "Recruit",
      xp: 0,
      streak: 1,
      lastLogin: now,
      createdAt: now,
      completedLabs: [],
    };

    const token = generateMockJwt(operator.handle);
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem("zdg_token", token);
      localStorage.setItem("zdg_mock_auth", "true");
    } catch {
      // ignore
    }

    saveOperator(operator);
    setUser(operator);
    setGlobalXp(0);
    setStreakCount(1);
    setCompletedLabs([]);
  }, []);

  // ── Logout: clear everything ──
  const logout = useCallback(async () => {
    clearOperator();
    try {
      localStorage.removeItem("zdg_mock_auth");
      localStorage.removeItem("zdg_token");
      localStorage.removeItem("zdg_refresh");
    } catch {
      // ignore
    }
    setUser(null);
    setGlobalXp(0);
    setStreakCount(0);
    setCompletedLabs([]);
  }, []);

  // ── Add XP and persist ──
  const addXp = useCallback(
    (amount: number) => {
      setUser((current) => {
        if (!current) return current;
        const newXp = current.xp + amount;
        const updated: ZdgOperator = {
          ...current,
          xp: newXp,
          rank: calculateOperatorRank(newXp),
        };
        saveOperator(updated);
        setGlobalXp(newXp);
        return updated;
      });
    },
    []
  );

  // ── Complete a lab and persist ──
  const completeLab = useCallback(
    (labId: string) => {
      setUser((current) => {
        if (!current) return current;
        if (current.completedLabs.includes(labId)) return current;
        const newLabs = [...current.completedLabs, labId];
        const updated: ZdgOperator = {
          ...current,
          completedLabs: newLabs,
        };
        saveOperator(updated);
        setCompletedLabs(newLabs);
        return updated;
      });
    },
    []
  );

  // ── Memoized context value ──
  const value = useMemo<ZdgContextValue>(
    () => ({
      user,
      globalXp,
      streakCount,
      completedLabs,
      isAuthenticated: user !== null,
      isLoading,
      login,
      signup,
      logout,
      addXp,
      completeLab,
      syncFromGamification,
    }),
    [user, globalXp, streakCount, completedLabs, isLoading, login, signup, logout, addXp, completeLab, syncFromGamification]
  );

  return <ZdgContext.Provider value={value}>{children}</ZdgContext.Provider>;
};

// ── Hook ──

export const useZdg = (): ZdgContextValue => {
  const ctx = useContext(ZdgContext);
  if (ctx === ZDG_CONTEXT_EMPTY) {
    throw new Error("useZdg must be used within a ZdgProvider");
  }
  return ctx;
};

export default ZdgContext;
