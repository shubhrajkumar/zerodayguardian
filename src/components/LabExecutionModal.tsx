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
}

type Props = {
  open: boolean;
  activeLab: LabModel | null;
  command: string;
  running: boolean;
  consoleLines: string[];
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
                  <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-100/80">Neon Sandbox Console</p>
                  <h2 className="mt-2 font-mono text-2xl font-semibold text-cyan-50 drop-shadow-[0_0_12px_rgba(34,211,238,0.45)]">{activeLab.title}</h2>
                  <p className="mt-2 text-sm text-cyan-100/80">{activeLab.description}</p>
                </div>
                <span className="rounded-full border border-cyan-300/50 bg-cyan-500/15 px-2 py-0.5 text-[11px] text-cyan-100">
                  {difficultyFromLab(activeLab.id)}
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
            </header>

            <div className="grid min-h-0 gap-4 overflow-y-auto p-4 md:grid-cols-[1.35fr_0.85fr] md:px-6">
              <section className="rounded-xl border border-cyan-300/30 bg-black/50 p-4">
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
                <p className="mb-2 text-xs text-cyan-200">Lab Steps</p>
                <ul className="mt-2 space-y-2 text-xs text-cyan-100/85">
                  {activeLab.steps.slice(0, 4).map((step, index) => (
                    <li key={step} className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-500/15 text-[11px] text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.35)]">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 rounded-lg border border-cyan-300/25 bg-black/50 px-3 py-2 text-[11px] text-cyan-100/80">
                  Reward: {activeLab.challengeModeHint}
                </div>
              </section>

              <section className="rounded-xl border border-cyan-300/35 bg-black/70 p-4 md:col-span-2">
                <div className="mb-2 flex items-center justify-between text-xs text-cyan-200">
                  <span>Sandbox Output</span>
                  <span className="rounded-full border border-cyan-300/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-100">
                    Safe simulation
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
              Safe sandbox mode only. Commands are simulated and never execute on your real system.
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LabExecutionModal;
