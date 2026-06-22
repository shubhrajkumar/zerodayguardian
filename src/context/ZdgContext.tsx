/**
 * ZdgContext — Gamification Context with localStorage persistence.
 *
 * Manages:
 *   - Operator gamification profile (handle, rank, XP, streak, completed labs)
 *   - Persistent localStorage save (survives page refresh)
 *   - Daily streak calculation
 *   - XP tracking and lab completion tracking
 *
 * Note: Authentication is handled exclusively by AuthContext.
 * ZdgContext manages local gamification state only — no JWT,
 * no login/signup, no auth state.
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
  /** The current operator gamification profile, or null if none saved */
  user: ZdgOperator | null;
  /** Current total XP (sourced from operator + gamification localStorage) */
  globalXp: number;
  /** Current streak count (calculated from lastLogin vs now) */
  streakCount: number;
  /** Array of completed lab IDs */
  completedLabs: string[];
  /** Add XP to the operator's total and persist */
  addXp: (amount: number) => void;
  /** Mark a lab as completed and persist */
  completeLab: (labId: string) => void;
  /** Force a refresh of XP/streak from gamification storage */
  syncFromGamification: () => void;
};

const ZDG_CONTEXT_EMPTY: ZdgContextValue = {
  user: null,
  globalXp: 0,
  streakCount: 0,
  completedLabs: [],
  addXp: () => {},
  completeLab: () => {},
  syncFromGamification: () => {},
};

const ZdgContext = createContext<ZdgContextValue>(ZDG_CONTEXT_EMPTY);

// ── Utilities ──

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
  }, []);

  // ── Periodic gamification sync (every 30s) ──
  useEffect(() => {
    if (!user) return;
    gamificationSyncTimerRef.current = setInterval(syncFromGamification, 30_000);
    return () => {
      if (gamificationSyncTimerRef.current) {
        clearInterval(gamificationSyncTimerRef.current);
      }
    };
  }, [user, syncFromGamification]);

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
      addXp,
      completeLab,
      syncFromGamification,
    }),
    [user, globalXp, streakCount, completedLabs, addXp, completeLab, syncFromGamification]
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
