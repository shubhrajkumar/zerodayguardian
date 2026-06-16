import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ValidationStep {
  id: string;
  instruction: string;
  /** Placeholder or hint for the input */
  hint?: string;
}

export interface ValidationLoopProps {
  steps: ValidationStep[];
  onValidate: (stepId: string, answer: string) => Promise<boolean>;
  onComplete?: () => void;
  onError?: (error: unknown) => void;
  /** Override the success animation */
  successElement?: ReactNode;
  /** Override the error message */
  errorMessage?: string;
}

type Phase = "read" | "submit" | "validate" | "unlock";

/**
 * ValidationLoop — 4-step state machine: read → submit → validate → unlock.
 *
 * 🔍 Cyber Rationale: Clear validation loops reduce abandonment by 30% (Baymard Institute).
 * Each step gives micro-feedback (loading → success → error → retry), building trust and
 * reducing cognitive friction. Keyboard-navigable, screen-reader-friendly, reduced-motion-safe.
 */
export default function ValidationLoop({
  steps,
  onValidate,
  onComplete,
  onError,
  successElement,
  errorMessage,
}: ValidationLoopProps) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("read");
  const [answer, setAnswer] = useState("");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const currentStep = steps[currentStepIdx];
  const isLastStep = currentStepIdx >= steps.length - 1;

  // Focus input when entering submit phase
  useEffect(() => {
    if (phase === "submit" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase]);

  // Announce phase changes to screen readers
  useEffect(() => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent =
        phase === "read"
          ? `Step ${currentStepIdx + 1}: Read the instruction.`
          : phase === "submit"
            ? `Step ${currentStepIdx + 1}: Enter your answer.`
            : phase === "validate"
              ? "Validating your answer..."
              : success
                ? "Correct! Moving to next step."
                : "Incorrect. Try again.";
    }
  }, [phase, currentStepIdx, success]);

  const handleReadComplete = useCallback(() => {
    setPhase("submit");
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!answer.trim() || validating) return;

      setValidating(true);
      setPhase("validate");
      setError(null);

      try {
        const isValid = await onValidate(currentStep.id, answer.trim());
        if (isValid) {
          setSuccess(true);
          setPhase("unlock");
          if (isLastStep) {
            onComplete?.();
          }
        } else {
          setError(errorMessage || "Incorrect. Review the instruction and try again.");
          setAttempts((prev) => prev + 1);
          setPhase("submit");
        }
      } catch (err) {
        setError(
          errorMessage || "Validation service unavailable. Please try again.",
        );
        setAttempts((prev) => prev + 1);
        setPhase("submit");
        onError?.(err);
      } finally {
        setValidating(false);
      }
    },
    [answer, validating, currentStep, onValidate, isLastStep, onComplete, onError, errorMessage],
  );

  const handleNext = useCallback(() => {
    if (isLastStep) return;
    setCurrentStepIdx((prev) => prev + 1);
    setPhase("read");
    setAnswer("");
    setError(null);
    setSuccess(false);
    setAttempts(0);
  }, [isLastStep]);

  const handleRetry = useCallback(() => {
    setError(null);
    setPhase("submit");
    setAnswer("");
  }, []);

  if (!currentStep) {
    return (
      <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--theme-accent-green)]" />
        <p className="mt-3 text-sm font-semibold text-[var(--theme-text)]">
          All steps complete!
        </p>
      </div>
    );
  }

  const progressPercent = ((currentStepIdx + (phase === "unlock" ? 1 : 0)) / steps.length) * 100;

  return (
    <div
      className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5"
      role="region"
      aria-label={`Validation step ${currentStepIdx + 1} of ${steps.length}`}
    >
      {/* Persistent screen-reader live region — always in DOM */}
      <div
        ref={liveRegionRef}
        className="sr-only"
        aria-live="assertive"
        aria-atomic="true"
      />
      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-[var(--theme-text-muted)]">
          <span>
            Step {currentStepIdx + 1} of {steps.length}
          </span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--theme-overlay)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--theme-accent-blue)] to-[var(--theme-accent-green)] transition-all duration-500 motion-reduce:transition-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Phase: READ */}
      {phase === "read" && (
        <div className="animate-fade-in space-y-4">
          <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-overlay)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-blue)]">
              Instruction
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--theme-text)]">
              {currentStep.instruction}
            </p>
          </div>
          <button
            type="button"
            onClick={handleReadComplete}
            className="w-full rounded-xl border border-[var(--theme-accent-blue)]/30 bg-[var(--theme-accent-blue)]/10 px-4 py-3 text-sm font-medium text-[var(--theme-accent-blue)] transition hover:bg-[var(--theme-accent-blue)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent-blue)] touch-target"
          >
            I understand — let me answer
          </button>
        </div>
      )}

      {/* Phase: SUBMIT */}
      {phase === "submit" && (
        <form onSubmit={handleSubmit} className="animate-fade-in space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-muted)]">
              Your Answer
            </span>
            <input
              ref={inputRef}
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={currentStep.hint || "Type your answer..."}
              disabled={validating}
              className={cn(
                "mt-2 w-full rounded-xl border bg-[var(--theme-overlay)] px-4 py-3 text-sm text-[var(--theme-text)] outline-none transition",
                "placeholder:text-[var(--theme-text-dim)]",
                "focus:border-[var(--theme-accent-blue)] focus:shadow-[0_0_0_3px_rgba(0,212,255,0.15)]",
                error ? "border-[var(--theme-error)]" : "border-[var(--theme-border)]",
              )}
              aria-describedby={error ? "validation-error" : undefined}
              aria-invalid={error ? "true" : undefined}
            />
          </label>

          {error && (
            <div
              id="validation-error"
              ref={feedbackRef}
              className="flex animate-shake items-start gap-2 rounded-xl border border-[var(--theme-error)]/20 bg-[var(--theme-error)]/8 px-4 py-3 text-sm text-[var(--theme-error)]"
              role="alert"
            >
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!answer.trim() || validating}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--theme-accent-blue)]/30 bg-[var(--theme-accent-blue)]/10 px-4 py-3 text-sm font-medium text-[var(--theme-accent-blue)] transition hover:bg-[var(--theme-accent-blue)]/20 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent-blue)] touch-target"
            >
              {validating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                "Submit Answer"
              )}
            </button>

            {attempts > 0 && (
              <button
                type="button"
                onClick={handleRetry}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--theme-border)] px-4 py-3 text-sm text-[var(--theme-text-muted)] transition hover:text-[var(--theme-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent-blue)] touch-target"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            )}
          </div>
        </form>
      )}

      {/* Phase: VALIDATE (loading) */}
      {phase === "validate" && (
        <div className="flex animate-fade-in flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--theme-accent-blue)]" />
          <p className="mt-3 text-sm text-[var(--theme-text-muted)]">
            Checking your answer...
          </p>
        </div>
      )}

      {/* Phase: UNLOCK (success) */}
      {phase === "unlock" && (
        <div className="animate-scale-in space-y-4 py-4 text-center motion-reduce:animate-fade-in">
          {successElement || (
            <div className="space-y-2">
              <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--theme-accent-green)]" />
              <p className="text-lg font-semibold text-[var(--theme-accent-green)]">
                Correct!
              </p>
              <p className="text-sm text-[var(--theme-text-muted)]">
                {isLastStep
                  ? "All steps completed successfully!"
                  : "Ready for the next step."}
              </p>
            </div>
          )}

          {!isLastStep && (
            <button
              type="button"
              onClick={handleNext}
              className="w-full rounded-xl border border-[var(--theme-accent-green)]/30 bg-[var(--theme-accent-green)]/10 px-4 py-3 text-sm font-medium text-[var(--theme-accent-green)] transition hover:bg-[var(--theme-accent-green)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent-green)] touch-target"
            >
              Continue to Step {currentStepIdx + 2}
            </button>
          )}
        </div>
      )}


    </div>
  );
}
