import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Brain, CheckCircle2, HelpCircle, ShieldAlert } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { DailyQuizAnswer, GamificationSnapshot } from "@/lib/gamificationSystem";

type QuizWidgetProps = {
  snapshot: GamificationSnapshot;
  loading: boolean;
  error: string;
  onAnswer: (questionId: string, optionId: string) => Promise<DailyQuizAnswer | null>;
};

const animation = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };

const QuizWidget = ({ snapshot, loading, error, onAnswer }: QuizWidgetProps) => {
  const correctCount = useMemo(
    () => Object.values(snapshot.quizAnswers).filter((answer) => answer.correct).length,
    [snapshot.quizAnswers]
  );

  useEffect(() => {
    if (!correctCount) return;
    confetti({
      particleCount: 36,
      spread: 44,
      origin: { y: 0.4 },
      scalar: 0.68,
      ticks: 72,
      colors: ["#00ff88", "#e2e8f0", "#0066ff"],
    });
  }, [correctCount]);

  return (
    <section data-reveal className="gamification-shell rounded-[28px] border border-blue-400/18 p-5 sm:p-6">
      <div className="gamification-shell__bg gamification-shell__bg--alt" aria-hidden="true" />
      <div className="relative z-[1]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-blue-100/72">Daily Cipher Quiz</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#e2e8f0]">Five questions. Fast judgment. No dead air.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300/80">
              Every correct answer injects <strong className="text-[#e2e8f0]">+50 XP</strong>. Wrong answers explain the miss immediately so learning still compounds.
            </p>
          </div>
          <div className="rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-50">
            {correctCount}/{snapshot.quizQuestions.length || 5} correct
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4">
          {snapshot.quizQuestions.map((question, index) => {
            const answer = snapshot.quizAnswers[question.id];
            return (
              <motion.article
                key={question.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...animation, delay: index * 0.03 }}
                className="rounded-[24px] border border-white/8 bg-black/18 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-400/18 bg-blue-500/10 text-blue-100">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="terminal-font text-[11px] uppercase tracking-[0.2em] text-slate-500">Question 0{index + 1}</p>
                    <h3 className="mt-2 text-lg font-semibold text-[#e2e8f0]">{question.prompt}</h3>

                    <div className="mt-4 grid gap-2">
                      {question.options.map((option) => {
                        const selected = answer?.selectedOptionId === option.id;
                        const correct = question.correctOptionId === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            disabled={Boolean(answer) || loading}
                            onClick={() => void onAnswer(question.id, option.id)}
                            className={`rounded-[18px] border px-4 py-3 text-left transition ${
                              answer
                                ? selected && answer.correct
                                  ? "border-emerald-400/24 bg-emerald-500/12 text-emerald-50"
                                  : selected && !answer.correct
                                    ? "border-rose-400/24 bg-rose-500/12 text-rose-50"
                                    : correct
                                      ? "border-blue-400/20 bg-blue-500/10 text-blue-50"
                                      : "border-white/8 bg-white/[0.03] text-slate-300"
                                : "border-white/8 bg-white/[0.03] text-[#e2e8f0] hover:border-blue-400/24 hover:bg-blue-500/10"
                            }`}
                          >
                            <span className="flex items-center gap-3">
                              <span className="text-xl">{option.emoji}</span>
                              <span className="text-sm font-medium">{option.label}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {answer ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={animation}
                        className={`mt-4 rounded-[18px] border px-4 py-3 text-sm ${
                          answer.correct
                            ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-50"
                            : "border-amber-300/20 bg-amber-500/10 text-amber-50"
                        }`}
                      >
                        <p className="inline-flex items-center gap-2 font-semibold">
                          {answer.correct ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                          {answer.correct ? `Correct. +${answer.pointsAwarded} XP injected.` : "Not clean yet. Here's the fix."}
                        </p>
                        <p className="mt-2 leading-6">{answer.explanation}</p>
                      </motion.div>
                    ) : (
                      <div className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                        <HelpCircle className="h-3.5 w-3.5" />
                        Instant feedback armed
                      </div>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default QuizWidget;
