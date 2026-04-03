import { createContext, ReactNode, useContext, useMemo } from "react";
import { useUserProgress } from "@/context/UserProgressContext";
import { useLearningMode } from "@/context/LearningModeContext";
import { useMissionSystem } from "@/context/MissionSystemApiContext";

type MentorDifficulty = "guided" | "adaptive" | "elite";

type MentorFocus = {
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

type AdaptiveMentorState = {
  difficulty: MentorDifficulty;
  difficultyLabel: string;
  confidence: number;
  tone: string;
  summary: string;
  primaryFocus: MentorFocus | null;
  secondaryFocus: MentorFocus | null;
  recommendation: string;
  microAction: string;
  pathTitle: string;
};

const AdaptiveMentorContext = createContext<AdaptiveMentorState | null>(null);

const getDifficulty = (level: number, streak: number, momentum: number): MentorDifficulty => {
  if (level >= 7 || (streak >= 6 && momentum >= 72)) return "elite";
  if (level >= 3 || momentum >= 38) return "adaptive";
  return "guided";
};

export const AdaptiveMentorProvider = ({ children }: { children: ReactNode }) => {
  const { progress } = useUserProgress();
  const { mindset, accentLabel } = useLearningMode();
  const { momentum, streak, tasks, challenge } = useMissionSystem();

  const value = useMemo<AdaptiveMentorState>(() => {
    const weakest = progress.skillGraph.weakest[0];
    const strongest = progress.skillGraph.strongest[0];
    const recommendedPath = progress.skillGraph.recommendedPath[0];
    const difficulty = getDifficulty(progress.level, streak, momentum);
    const confidence = Math.min(96, 42 + progress.todayActions * 8 + progress.completedLabs * 3 + streak * 2);

    const primaryFocus: MentorFocus | null = weakest
      ? {
          title: `Close gap: ${weakest.label}`,
          detail: weakest.gap > 25 ? "High-impact weakness detected. Keep the next mission scoped and deliberate." : "Skill gap is narrowing. Convert reps into faster decisions.",
          priority: weakest.gap > 25 ? "high" : "medium",
        }
      : null;

    const secondaryFocus: MentorFocus | null = strongest
      ? {
          title: `Leverage strength: ${strongest.label}`,
          detail: "Use your strongest zone to build confidence before switching into a weaker skill path.",
          priority: "low",
        }
      : null;

    const recommendation =
      recommendedPath?.action ||
      (primaryFocus
        ? `Run a short ${mindset} mission that strengthens ${primaryFocus.title.replace("Close gap: ", "")}.`
        : `Stay in ${accentLabel.toLowerCase()} and finish one guided task to give the mentor more performance signal.`);

    const microAction = tasks.find((task) => !task.completed)?.title || challenge.detail;
    const pathTitle =
      recommendedPath?.label ||
      (primaryFocus ? primaryFocus.title.replace("Close gap: ", "") : strongest?.label || "Mission momentum");

    const summary =
      difficulty === "guided"
        ? "You are in guided mode. The mentor should reduce noise, keep tasks short, and build confidence through quick wins."
        : difficulty === "adaptive"
          ? "You are in adaptive mode. The mentor should balance challenge and speed, using your recent performance to tune the next step."
          : "You are in elite mode. The mentor should raise difficulty, shorten hints, and optimize for faster operator judgment.";

    return {
      difficulty,
      difficultyLabel: difficulty === "guided" ? "Guided Build" : difficulty === "adaptive" ? "Adaptive Flow" : "Elite Push",
      confidence,
      tone: accentLabel,
      summary,
      primaryFocus,
      secondaryFocus,
      recommendation,
      microAction,
      pathTitle,
    };
  }, [accentLabel, challenge.detail, mindset, momentum, progress.completedLabs, progress.level, progress.skillGraph.recommendedPath, progress.skillGraph.strongest, progress.skillGraph.weakest, progress.todayActions, streak, tasks]);

  return <AdaptiveMentorContext.Provider value={value}>{children}</AdaptiveMentorContext.Provider>;
};

export const useAdaptiveMentor = () => {
  const context = useContext(AdaptiveMentorContext);
  if (!context) {
    throw new Error("useAdaptiveMentor must be used within AdaptiveMentorProvider");
  }
  return context;
};
