import { FormEvent, useEffect } from "react";
import { X } from "lucide-react";

interface LabModel {
  id: string;
  title: string;
  description: string;
  objective: string;
  practiceEnvironment: string;
  steps: string[];
  recommendedTools: string[];
  challengeModeHint: string;
  allowedCommands: string[];
  tips: string[];
  mode?: string;
  verified?: boolean;
  separationNotice?: string;
  level?: "beginner" | "intermediate" | "advanced" | "pro";
  track?: string;
  estimatedMinutes?: number;
  objectives?: string[];
  stepHints?: string[];
  scoring?: { maxPoints: number; commandPoints: number; completionBonus: number; badges: string[] };
  mentorFocus?: string;
  scenarioType?: string;
  vulnerabilityClass?: string;
  operatorRole?: string;
  attackNarrative?: string;
  realtimeSignals?: string[];
}

interface MissionFeedback {
  status: string;
  riskLevel: string;
  confidence: number;
  evidenceCount: number;
  operatorAction: string;
  realtimeSignals: string[];
  mistakes?: string[];
  betterApproach?: string[];
  nextAction?: string;
  urgency?: string;
  scenarioType?: string;
  vulnerabilityClass?: string;
  operatorRole?: string;
  branchOutcome?: { id: string; title: string; condition: string; reward: string } | null;
}

interface SandboxMissionState {
  step_index: number;
  total_steps: number;
  current_objective: string;
  next_action: string;
  expected_outcome: string;
  cleared_objectives: string[];
  available_actions: string[];
}

type Props = {
  open: boolean;
  activeLab: LabModel | null;
  command: string;
  running: boolean;
  consoleLines: string[];
  missionFeedback: MissionFeedback | null;
  missionState: SandboxMissionState | null;
  missionMode: "solo" | "squad";
  timerLabel: string;
  onCommandChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  onPickAllowedCommand: (value: string) => void;
};

const difficultyFromLab = (labId: string) => {
  if (labId.includes("basics")) return "Beginner";
  if (labId.includes("exploit")) return "Advanced";
  return "Intermediate";
};

const LabExecutionModal = ({
  open,
  activeLab,
  command,
  running,
  consoleLines,
  missionFeedback,
  missionState,
  missionMode,
  timerLabel,
  onCommandChange,
  onClose,
  onSubmit,
  onPickAllowedCommand,
}: Props) => {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !activeLab) return null;
  const riskTone =
    String(missionFeedback?.riskLevel || "").toUpperCase() === "HIGH"
      ? "border-rose-300/35 bg-rose-500/10 text-rose-100"
      : String(missionFeedback?.riskLevel || "").toUpperCase() === "MEDIUM"
        ? "border-amber-300/35 bg-amber-500/10 text-amber-100"
        : "border-emerald-300/35 bg-emerald-500/10 text-emerald-100";
  const stepLabel = `${missionState?.step_index || 1}/${missionState?.total_steps || Math.max(1, activeLab.objectives?.length || activeLab.steps.length || 1)}`;
  const safeCurrentObjective = missionState?.current_objective || activeLab.objective || activeLab.steps?.[0] || "Mission objective";
  const safeNextAction = missionState?.next_action || activeLab.allowedCommands.find((cmd) => cmd !== "help" && cmd !== "status") || activeLab.allowedCommands[0] || "help";
  const safeExpectedOutcome = missionState?.expected_outcome || "Advance the mission by clearing the current objective.";
  const responseMistakes = missionFeedback?.mistakes?.length ? missionFeedback.mistakes : ["No major mistakes recorded yet. Run an action to get evaluation."];
  const responseApproach = missionFeedback?.betterApproach?.length ? missionFeedback.betterApproach : ["Follow the next mission action and validate the resulting signal."];
  const responseSignals = missionFeedback?.realtimeSignals?.length ? missionFeedback.realtimeSignals : activeLab.realtimeSignals || [];

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md transition-opacity duration-250">
      <div className="absolute inset-0 flex items-center justify-center p-0 md:p-6">
        <section className="relative h-full w-full overflow-hidden border border-cyan-300/40 bg-[#05060b] shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_40px_120px_rgba(0,0,0,0.7)] md:h-auto md:max-h-[92vh] md:max-w-6xl md:rounded-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(34,211,238,0.2),transparent_38%),radial-gradient(circle_at_88%_14%,rgba(244,63,94,0.18),transparent_40%),radial-gradient(circle_at_50%_80%,rgba(14,116,144,0.25),transparent_45%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(transparent_96%,rgba(56,189,248,0.08)),linear-gradient(90deg,transparent_96%,rgba(56,189,248,0.08))] [background-size:22px_22px]" />
          <button
            type="button"
            className="absolute right-3 top-3 z-10 rounded border border-cyan-300/40 bg-black/50 p-1.5 text-cyan-100 hover:bg-cyan-500/20"
            onClick={onClose}
            aria-label="Close lab modal"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative grid h-full grid-rows-[auto_1fr_auto] overflow-hidden">
            <header className="border-b border-cyan-300/25 px-4 py-4 md:px-6">
              <div className="flex items-start justify-between gap-3 pr-10">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-100/80">Simulated Mission Console</p>
                  <h2 className="mt-2 font-mono text-2xl font-semibold text-cyan-50 drop-shadow-[0_0_12px_rgba(34,211,238,0.45)]">{activeLab.title}</h2>
                  <p className="mt-2 text-sm text-cyan-100/80">{activeLab.description}</p>
                </div>
                <span className="rounded-full border border-cyan-300/50 bg-cyan-500/15 px-2 py-0.5 text-[11px] text-cyan-100">
                  {String(activeLab.level || difficultyFromLab(activeLab.id)).toUpperCase()}
                </span>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-[1.2fr_1fr]">
                <div className="rounded-lg border border-cyan-300/25 bg-black/50 px-3 py-2 text-xs text-cyan-100/85">
                  <strong>Objective:</strong> {activeLab.objective}
                </div>
                <div className="rounded-lg border border-cyan-300/25 bg-black/50 px-3 py-2 text-xs text-cyan-100/85">
                  <strong>Environment:</strong> {activeLab.practiceEnvironment}
                </div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <div className={`rounded-lg border px-3 py-2 text-xs ${riskTone}`}>
                  <strong>Risk:</strong> {missionFeedback?.riskLevel || "LOW"}
                </div>
                <div className="rounded-lg border border-cyan-300/25 bg-black/50 px-3 py-2 text-xs text-cyan-100/85">
                  <strong>Scenario:</strong> {(missionFeedback?.scenarioType || activeLab.scenarioType || "guided simulator").replace(/-/g, " ")}
                </div>
                <div className="rounded-lg border border-cyan-300/25 bg-black/50 px-3 py-2 text-xs text-cyan-100/85">
                  <strong>Role:</strong> {(missionFeedback?.operatorRole || activeLab.operatorRole || "security learner").replace(/-/g, " ")}
                </div>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <div className="rounded-lg border border-cyan-300/25 bg-black/50 px-3 py-2 text-xs text-cyan-100/85">
                  <strong>Timer:</strong> {timerLabel}
                </div>
                <div className="rounded-lg border border-cyan-300/25 bg-black/50 px-3 py-2 text-xs text-cyan-100/85">
                  <strong>Mode:</strong> {missionMode}
                </div>
                <div className="rounded-lg border border-cyan-300/25 bg-black/50 px-3 py-2 text-xs text-cyan-100/85">
                  <strong>Branch:</strong> {missionFeedback?.branchOutcome?.title || "awaiting signal"}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-amber-300/40 bg-amber-500/12 px-2 py-0.5 text-[11px] text-amber-100">
                  Simulated output
                </span>
                <span className="rounded-full border border-cyan-300/35 bg-cyan-500/12 px-2 py-0.5 text-[11px] text-cyan-100">
                  {activeLab.track?.replace(/-/g, " ") || "guided mission"}
                </span>
                <span className="rounded-full border border-cyan-300/35 bg-cyan-500/12 px-2 py-0.5 text-[11px] text-cyan-100">
                  Real scans stay in Dashboard / OSINT
                </span>
              </div>
            </header>

            <div className="grid min-h-0 gap-4 overflow-y-auto p-4 md:grid-cols-[1.1fr_0.9fr] md:px-6">
              <section className="rounded-xl border border-cyan-300/30 bg-black/50 p-4">
                <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                  <div>
                    <p className="mb-1 text-xs text-cyan-200">Mission Panel</p>
                    <p className="text-lg font-semibold text-cyan-50">{safeCurrentObjective}</p>
                    <p className="mt-2 text-xs text-cyan-100/78">{safeExpectedOutcome}</p>
                  </div>
                  <div className="rounded-lg border border-cyan-300/25 bg-black/50 px-3 py-2 text-xs text-cyan-100/85">
                    Step {stepLabel}
                  </div>
                </div>
                <div className="mb-4 rounded-lg border border-cyan-300/20 bg-black/45 px-3 py-3 text-xs text-cyan-100/82">
                  <strong>Next action:</strong> {safeNextAction}
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  {(missionState?.available_actions?.length ? missionState.available_actions : activeLab.allowedCommands.filter((cmd) => cmd !== "help" && cmd !== "status").slice(0, 4)).map((action) => (
                    <button
                      key={action}
                      type="button"
                      className="rounded-full border border-cyan-300/30 px-2.5 py-1 text-[11px] text-cyan-50/90 hover:bg-cyan-500/15"
                      onClick={() => onPickAllowedCommand(action)}
                    >
                      {action}
                    </button>
                  ))}
                </div>
                <p className="mb-2 text-xs text-cyan-200">Command Input</p>
                <form onSubmit={onSubmit} className="flex flex-col gap-2 md:flex-row">
                  <input
                    value={command}
                    onChange={(event) => onCommandChange(event.target.value)}
                    className="flex-1 rounded-md border border-cyan-300/30 bg-black/60 px-3 py-2 text-sm text-cyan-100 placeholder:text-cyan-200/40 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                    placeholder="Type a safe command (e.g. help)"
                  />
                  <button type="submit" className="rounded-md border border-cyan-300/50 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-500/15 shadow-[0_0_16px_rgba(34,211,238,0.25)]" disabled={running}>
                    {running ? "Running..." : "Run Command"}
                  </button>
                </form>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeLab.allowedCommands.map((allowed) => (
                    <button
                      key={allowed}
                      type="button"
                      className="rounded-full border border-cyan-300/30 px-2 py-1 text-[11px] text-cyan-50/90 hover:bg-cyan-500/15"
                      onClick={() => onPickAllowedCommand(allowed)}
                    >
                      {allowed}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-cyan-300/25 bg-black/45 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="mb-2 text-xs text-cyan-200">Progress</p>
                  <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-100">Step {stepLabel}</span>
                </div>
                <ul className="mt-2 space-y-2 text-xs text-cyan-100/85">
                  {(activeLab.objectives?.length ? activeLab.objectives : activeLab.steps).slice(0, 4).map((step, index) => (
                    <li key={step} className="flex items-start gap-2">
                      <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] shadow-[0_0_10px_rgba(34,211,238,0.35)] ${
                        (missionState?.cleared_objectives || []).includes(step)
                          ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
                          : safeCurrentObjective === step
                            ? "border-cyan-300/40 bg-cyan-500/15 text-cyan-100"
                            : "border-cyan-300/25 bg-black/40 text-cyan-100/80"
                      }`}>
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 rounded-lg border border-cyan-300/25 bg-black/50 px-3 py-2 text-[11px] text-cyan-100/80">
                  Reward: {activeLab.challengeModeHint}
                </div>
                <div className="mt-3 rounded-lg border border-cyan-300/20 bg-black/50 px-3 py-2 text-[11px] text-cyan-100/80">
                  Score model: +{activeLab.scoring?.commandPoints || 10} per command, +{activeLab.scoring?.completionBonus || 20} on completion, max {activeLab.scoring?.maxPoints || 100}.
                </div>
                {activeLab.stepHints?.length ? (
                  <div className="mt-3 rounded-lg border border-cyan-300/20 bg-black/50 px-3 py-2 text-[11px] text-cyan-100/80">
                    Hint: {activeLab.stepHints[0]}
                  </div>
                ) : null}
                <div className="mt-3 rounded-lg border border-cyan-300/20 bg-black/50 px-3 py-2 text-[11px] text-cyan-100/80">
                  <strong>Team Debrief Cue:</strong> {(missionFeedback?.operatorAction || activeLab.attackNarrative || "Capture the strongest signal and summarize the next operator action.")}
                </div>
              </section>

              <section className="rounded-xl border border-cyan-300/25 bg-black/45 p-4">
                <p className="mb-2 text-xs text-cyan-200">Response Panel</p>
                <div className={`rounded-lg border px-3 py-2 text-[11px] ${riskTone}`}>
                  Status: {(missionFeedback?.status || "scenario-loaded").replace(/-/g, " ")}
                </div>
                <div className="mt-3 rounded-lg border border-cyan-300/20 bg-black/50 px-3 py-2 text-[11px] text-cyan-100/80">
                  Confidence: {missionFeedback?.confidence || 0}% | Evidence: {missionFeedback?.evidenceCount || 0}
                </div>
                <div className="mt-3 rounded-lg border border-cyan-300/20 bg-black/50 px-3 py-2 text-[11px] text-cyan-100/80">
                  <strong>Action:</strong> {missionFeedback?.operatorAction || "Run a guided command to receive tactical feedback."}
                </div>
                <div className="mt-3 rounded-lg border border-cyan-300/20 bg-black/50 px-3 py-2 text-[11px] text-cyan-100/80">
                  <strong>Next step:</strong> {missionFeedback?.nextAction || safeNextAction}
                </div>
                <div className="mt-3 rounded-lg border border-cyan-300/20 bg-black/50 px-3 py-2 text-[11px] text-cyan-100/80">
                  <strong>Vulnerability:</strong> {(missionFeedback?.vulnerabilityClass || activeLab.vulnerabilityClass || "training only").replace(/-/g, " ")}
                </div>
                <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-500/8 px-3 py-2 text-[11px] text-rose-100/85">
                  <strong>Mistakes:</strong>
                  <ul className="mt-2 space-y-1">
                    {responseMistakes.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-500/8 px-3 py-2 text-[11px] text-emerald-100/85">
                  <strong>Better approach:</strong>
                  <ul className="mt-2 space-y-1">
                    {responseApproach.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
                {missionFeedback?.branchOutcome ? (
                  <div className="mt-3 rounded-lg border border-cyan-300/20 bg-black/50 px-3 py-2 text-[11px] text-cyan-100/80">
                    <strong>Branch Outcome:</strong> {missionFeedback.branchOutcome.title}
                    <div className="mt-1 text-cyan-100/70">{missionFeedback.branchOutcome.condition}</div>
                    <div className="mt-1 text-cyan-100/60">Reward: {missionFeedback.branchOutcome.reward}</div>
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {responseSignals.slice(0, 5).map((signal) => (
                    <span key={signal} className="rounded-full border border-cyan-300/30 bg-cyan-500/12 px-2 py-1 text-[10px] uppercase tracking-wide text-cyan-100">
                      {signal.replace(/-/g, " ")}
                    </span>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-cyan-300/35 bg-black/70 p-4 md:col-span-2">
                <div className="mb-2 flex items-center justify-between text-xs text-cyan-200">
                  <span>Sandbox Output</span>
                  <span className="rounded-full border border-cyan-300/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-100">
                    Training mode
                  </span>
                </div>
                <div className="max-h-[42vh] overflow-y-auto rounded-md border border-cyan-300/25 bg-black/80 p-3 font-mono text-xs text-cyan-50/95 shadow-[inset_0_0_20px_rgba(34,211,238,0.12)]">
                  {consoleLines.map((line, idx) => (
                    <pre key={`${line}-${idx}`} className="whitespace-pre-wrap">{line}</pre>
                  ))}
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-cyan-200/80">
                    <span className="neon-cursor" aria-hidden="true" />
                    {running ? (
                      <span className="neon-typing">executing</span>
                    ) : (
                      <span className="text-cyan-200/60">ready</span>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <footer className="border-t border-cyan-300/25 px-4 py-3 text-xs text-cyan-100/75 md:px-6">
              {activeLab.separationNotice || "This lab uses realistic simulated outputs for learning. Use live Dashboard and OSINT modules for verified scans."}
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LabExecutionModal;
