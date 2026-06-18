import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, ChevronRight, Crown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useGamificationSystem, getRankByLevel, getNextRank } from "@/lib/gamificationSystem";
import UnlockAnimation from "@/components/gamification/UnlockAnimation";
import { springSnap } from "@/lib/animations";

interface CelebrationState {
  /** The rank the user just achieved */
  newRank: { icon: string; title: string; description: string };
  /** The previous rank */
  oldRank: { icon: string; title: string } | null;
  /** The new level number */
  level: number;
  /** Whether this is a major rank milestone (not just a level within same rank) */
  isRankMilestone: boolean;
}

/**
 * RankUpCelebration — Watches for level/rank changes and triggers
 * confetti + badge reveal animation when a user ranks up.
 *
 * Detects rank-ups via two mechanisms:
 * 1. `latestReward` with `tone === "level_up"` from mission/quiz completion
 * 2. `snapshot.level` changes via ref comparison (catches other sources)
 */
export default function RankUpCelebration() {
  const { user } = useAuth();
  const { snapshot, latestReward, clearLatestReward } = useGamificationSystem(
    user?.id,
    user?.name || undefined
  );

  const [celebration, setCelebration] = useState<CelebrationState | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const prevLevelRef = useRef(snapshot.level);
  const hasRewardFired = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Mechanism 1: Detect from latestReward (coming from mission/quiz completion) ──
  useEffect(() => {
    if (!latestReward || latestReward.tone !== "level_up" || hasRewardFired.current) return;
    hasRewardFired.current = true;

    const level = snapshot.level;
    const newRank = getRankByLevel(level);
    const prevRank = getRankByLevel(level - 1);

    // Check if the level change crossed a rank boundary
    const isRankMilestone = newRank.id !== prevRank.id;

    setCelebration({
      newRank: {
        icon: newRank.icon,
        title: newRank.title,
        description: newRank.description,
      },
      oldRank: isRankMilestone
        ? { icon: prevRank.icon, title: prevRank.title }
        : null,
      level,
      isRankMilestone,
    });

    // Fire confetti with a slight delay for React reconciliation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setShowConfetti(true));
    });

    // Auto-dismiss after 5s
    timerRef.current = setTimeout(() => {
      setDismissed(true);
      setTimeout(() => {
        clearLatestReward();
        setCelebration(null);
        setDismissed(false);
        hasRewardFired.current = false;
      }, 500);
    }, 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [latestReward, snapshot.level, clearLatestReward]);

  // ── Mechanism 2: Detect from snapshot.level changes (catches rank-ups from other sources) ──
  useEffect(() => {
    const currentLevel = snapshot.level;
    const prevLevel = prevLevelRef.current;

    if (currentLevel > prevLevel && !hasRewardFired.current) {
      hasRewardFired.current = true;

      const newRank = getRankByLevel(currentLevel);
      const prevRank = getRankByLevel(prevLevel);
      const isRankMilestone = newRank.id !== prevRank.id;

      setCelebration({
        newRank: {
          icon: newRank.icon,
          title: newRank.title,
          description: newRank.description,
        },
        oldRank: isRankMilestone
          ? { icon: prevRank.icon, title: prevRank.title }
          : null,
        level: currentLevel,
        isRankMilestone,
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => setShowConfetti(true));
      });

      timerRef.current = setTimeout(() => {
        setDismissed(true);
        setTimeout(() => {
          setCelebration(null);
          setDismissed(false);
          hasRewardFired.current = false;
        }, 500);
      }, 5000);
    }

    prevLevelRef.current = currentLevel;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [snapshot.level]);

  const handleDismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDismissed(true);
    setTimeout(() => {
      clearLatestReward();
      setCelebration(null);
      setDismissed(false);
      hasRewardFired.current = false;
    }, 300);
  }, [clearLatestReward]);

  if (!celebration) return null;

  const isElite = celebration.newRank.title === "Elite Guardian";

  return (
    <AnimatePresence>
      {!dismissed && (
        <>
          {/* Confetti */}
          <UnlockAnimation trigger={showConfetti} soundEnabled={celebration.isRankMilestone} />

          {/* Overlay backdrop */}
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050508]/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={handleDismiss}
          >
            {/* Celebration card */}
            <motion.div
              className="relative mx-auto max-w-md w-full px-6"
              initial={{ scale: 0.8, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 p-8 text-center shadow-[0_0_60px_rgba(52,211,153,0.1)] hologram-card">
                {/* Rank badge */}
                <div className="relative mx-auto mb-6">
                  <motion.div
                    className={`flex h-28 w-28 items-center justify-center rounded-full border-2 mx-auto ${
                      isElite
                        ? "border-amber-400/50 bg-gradient-to-br from-amber-500/15 to-purple-500/15"
                        : celebration.isRankMilestone
                        ? "border-emerald-400/40 bg-gradient-to-br from-emerald-500/15 to-cyan-500/15"
                        : "border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10"
                    }`}
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.3 }}
                  >
                    <motion.span
                      className={`${isElite ? "text-5xl" : "text-5xl"}`}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.6, type: "spring", stiffness: 300 }}
                    >
                      {celebration.newRank.icon}
                    </motion.span>
                  </motion.div>

                  {/* Pulse rings */}
                  <motion.span
                    className={`absolute -inset-3 rounded-full border ${
                      isElite
                        ? "border-amber-400/20"
                        : "border-emerald-400/20"
                    }`}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.3, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  />
                  <motion.span
                    className={`absolute -inset-6 rounded-full border ${
                      isElite
                        ? "border-amber-400/10"
                        : "border-emerald-400/10"
                    }`}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.3, opacity: 0 }}
                    transition={{ duration: 2, delay: 0.3, repeat: Infinity, ease: "easeOut" }}
                  />
                </div>

                {/* Label */}
                <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1 mb-4 ${
                  isElite
                    ? "border-amber-400/20 bg-amber-500/10"
                    : celebration.isRankMilestone
                    ? "border-emerald-400/20 bg-emerald-500/10"
                    : "border-cyan-400/20 bg-cyan-500/10"
                }`}>
                  <motion.span
                    className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.2em] ${
                    isElite ? "text-amber-300" : "text-emerald-300"
                  }`}>
                    {isElite
                      ? "ELITE RANK ACHIEVED"
                      : celebration.isRankMilestone
                      ? "RANK PROMOTION"
                      : "LEVEL ADVANCED"}
                  </span>
                </div>

                {/* Title */}
                <motion.h2
                  className={`text-2xl font-bold mb-1 ${
                    isElite ? "text-amber-100" : "text-slate-100"
                  }`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  {celebration.isRankMilestone
                    ? `${celebration.newRank.icon} ${celebration.newRank.title}`
                    : `Level ${celebration.level} Unlocked`}
                </motion.h2>

                <motion.p
                  className="text-sm text-slate-400 mb-1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                >
                  {celebration.newRank.description}
                </motion.p>

                {/* Rank progression display */}
                {celebration.isRankMilestone && celebration.oldRank && (
                  <motion.div
                    className="mt-4 mb-4 flex items-center justify-center gap-3 text-sm"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.1 }}
                  >
                    <span className="text-slate-400">{celebration.oldRank.icon} {celebration.oldRank.title}</span>
                    <motion.span
                      className="text-emerald-400"
                      animate={{ x: [0, 3, 0] }}
                      transition={{ duration: 0.5, delay: 1.3 }}
                    >
                      <Crown className="h-4 w-4" />
                    </motion.span>
                    <span className="text-emerald-300 font-semibold">{celebration.newRank.icon} {celebration.newRank.title}</span>
                  </motion.div>
                )}

                {/* Unlocks */}
                {celebration.isRankMilestone && (
                  <motion.div
                    className="mt-4 rounded-xl border border-slate-800/40 bg-slate-800/20 p-4 text-left"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.3 }}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-400/80 mb-2">
                      New Unlocks
                    </p>
                    <ul className="space-y-1.5">
                      {getRankByLevel(snapshot.level).unlocks.map((unlock) => (
                        <li key={unlock} className="flex items-center gap-2 text-xs text-slate-300">
                          <Zap className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                          {unlock}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}

                {/* Next rank hint */}
                {(() => {
                  const next = getNextRank(snapshot.level);
                  return next ? (
                    <motion.div
                      className="mt-3 text-xs text-slate-500"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.6 }}
                    >
                      Next rank: {next.icon} {next.title} (Level {next.minLevel})
                    </motion.div>
                  ) : (
                    <motion.div
                      className="mt-3 text-xs text-amber-400/80 font-semibold"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.6 }}
                    >
                      🏆 Maximum rank achieved — you are an Elite Guardian
                    </motion.div>
                  );
                })()}

                {/* Dismiss button */}
                <motion.button
                  type="button"
                  onClick={handleDismiss}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-800/50 border border-slate-700/50 px-5 py-2.5 text-xs font-medium text-slate-300 hover:text-slate-100 hover:border-slate-600/50 transition-all"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={springSnap}
                >
                  Continue Operation
                  <ChevronRight className="h-3 w-3" />
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
