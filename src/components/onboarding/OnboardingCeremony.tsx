import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Swords, Terminal, Shield, Zap, ChevronRight, Cpu, Sparkles, Trophy } from "lucide-react";
import { useOnboarding } from "@/context/OnboardingContext";
import UnlockAnimation from "@/components/gamification/UnlockAnimation";
import {
  staggerContainer,
  staggerItem,
  fadeInUp,
  springSnap,
} from "@/lib/animations";

// ── Constants ──
type CeremonyStep = "boot" | "identity" | "rank" | "zorvix" | "briefing";

const RANKS = [
  { icon: "🪖", name: "Recruit", level: 1 },
  { icon: "🔐", name: "Operator", level: 2 },
  { icon: "🛡️", name: "Analyst", level: 4 },
  { icon: "🎯", name: "Hunter", level: 6 },
  { icon: "⚡", name: "Specialist", level: 8 },
  { icon: "👑", name: "Guardian", level: 10 },
  { icon: "💀", name: "Elite Guardian", level: 16 },
];

const BOOT_LINES = [
  { text: "INITIALIZING OPERATOR COMMISSIONING PROTOCOL...", delay: 300, type: "info" },
  { text: "Scanning neural identity matrix...", delay: 1000, type: "info" },
  { text: "Identity signature: UNREGISTERED", delay: 1800, type: "warn" },
  { text: "Establishing secure quantum uplink [████████░░] 82%", delay: 2600, type: "info" },
  { text: "Uplink secure — ZORVIX AI core detected", delay: 3400, type: "success" },
  { text: "Rank initialization: PENDING — Recruit status pending assignment", delay: 4200, type: "success" },
  { text: "PROTOCOL READY — Awaiting operator designation", delay: 5000, type: "prompt" },
];

// ── Sub-components ──

/** Step 1: Terminal boot sequence */
const BootSequence = ({ onComplete }: { onComplete: () => void }) => {
  const [lines, setLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState("");
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);

  // Cursor blink
  useEffect(() => {
    const interval = setInterval(() => setShowCursor((prev) => !prev), 530);
    return () => clearInterval(interval);
  }, []);

  // Typing effect
  useEffect(() => {
    if (lineIndex >= BOOT_LINES.length) {
      if (!completedRef.current) {
        completedRef.current = true;
        setTimeout(onComplete, 800);
      }
      return;
    }

    const line = BOOT_LINES[lineIndex];
    const timer = setTimeout(() => {
      if (charIndex < line.text.length) {
        setCurrentLine((prev) => prev + line.text[charIndex]);
        setCharIndex((prev) => prev + 1);
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      } else {
        const prefix = line.type === "success" ? "✓" : line.type === "warn" ? "⚠" : line.type === "prompt" ? ">" : "•";
        setLines((prev) => [...prev, `${prefix} ${line.text}`]);
        setCurrentLine("");
        setCharIndex(0);
        setLineIndex((prev) => prev + 1);
      }
    }, charIndex === 0 ? line.delay : 20 + Math.random() * 15);

    return () => clearTimeout(timer);
  }, [lineIndex, charIndex, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <motion.div
        className="w-full max-w-xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Terminal window */}
        <div className="rounded-xl border border-cyan-500/30 bg-[#050508]/95 backdrop-blur-sm overflow-hidden shadow-[0_0_40px_rgba(34,211,238,0.06)]">
          {/* Terminal header */}
          <div className="flex items-center gap-1.5 border-b border-slate-800/60 px-4 py-2.5 bg-slate-900/50">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            </div>
            <span className="ml-2 font-mono text-[10px] text-slate-500 tracking-wider">
              zdg-commission — zsh (SECURE MODE)
            </span>
          </div>

          {/* Terminal body */}
          <div
            ref={terminalRef}
            className="h-[320px] overflow-y-auto p-5 font-mono text-sm leading-relaxed"
            style={{ scrollbarWidth: "thin" }}
          >
            <div className="text-emerald-400 font-semibold mb-3 animate-hologram-flicker">
              ╔══════════════════════════════════════════╗
              <br />
              ║    ZERODAY GUARDIAN — OPERATOR COMMISSION    ║
              <br />
              ╚══════════════════════════════════════════╝
            </div>

            {lines.map((line, i) => {
              const isSuccess = line.startsWith("✓");
              const isWarn = line.startsWith("⚠");
              const isPrompt = line.startsWith(">");
              return (
                <div
                  key={i}
                  className={`mb-1 ${
                    isSuccess
                      ? "text-emerald-400"
                      : isWarn
                      ? "text-amber-400"
                      : isPrompt
                      ? "text-cyan-300"
                      : "text-slate-400"
                  }`}
                >
                  <span className="text-slate-600 mr-2">[{String(i + 1).padStart(2, "0")}:{String(Math.floor(Math.random() * 60)).padStart(2, "0")}:{String(Math.floor(Math.random() * 60)).padStart(2, "0")}]</span>
                  {line}
                </div>
              );
            })}
            {currentLine && (
              <div className="text-cyan-300 mb-1">
                <span className="text-slate-600 mr-2">[{String(lines.length + 1).padStart(2, "0")}:{String(new Date().getMinutes()).padStart(2, "0")}:{String(new Date().getSeconds()).padStart(2, "0")}]</span>
                <span className="text-emerald-400 mr-1">$</span> {currentLine}
                {showCursor && <span className="text-emerald-400 animate-terminal-blink">▌</span>}
              </div>
            )}

            {lineIndex >= BOOT_LINES.length && (
              <motion.div
                className="mt-4 text-emerald-400 font-bold animate-pulse"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                [SYSTEM] Commissioning protocol ready — proceeding...
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/** Step 2: Identity assignment — operator chooses callsign */
const IdentityAssignment = ({ onComplete }: { onComplete: (name: string) => void }) => {
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input after animation
    const timer = setTimeout(() => inputRef.current?.focus(), 600);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || "Operator";
    setSubmitted(true);
    setTimeout(() => onComplete(finalName), 800);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <motion.div
        className="w-full max-w-lg text-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Holographic badge */}
        <motion.div
          className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border-2 border-cyan-400/40 bg-gradient-to-br from-cyan-500/10 to-emerald-500/10"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
        >
          <span className="text-4xl">🪪</span>
        </motion.div>

        <motion.h2
          className="text-2xl font-bold text-slate-100 mb-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Designate Your Operator Identity
        </motion.h2>

        <motion.p
          className="text-sm text-slate-400 mb-8 max-w-md mx-auto"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          Choose your callsign. This identity will be your signature across all operations — missions, labs, and the leaderboard.
        </motion.p>

        {!submitted ? (
          <motion.form
            onSubmit={handleSubmit}
            className="space-y-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-emerald-400 text-sm">$</span>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your callsign..."
                maxLength={24}
                className="w-full rounded-xl border border-slate-700/50 bg-slate-900/60 py-4 pl-8 pr-4 font-mono text-sm text-slate-100 placeholder-slate-500 outline-none transition-all duration-200 focus:border-emerald-500/40 focus:shadow-[0_0_20px_rgba(52,211,153,0.06)]"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <motion.button
              type="submit"
              className="group inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:shadow-[0_0_30px_rgba(52,211,153,0.3)] active:scale-[0.98]"
              whileHover={{ scale: 1.02 }}
              whileTap={springSnap}
            >
              <Swords className="h-4 w-4" />
              Commission Operator
              <ChevronRight className="h-4 w-4" />
            </motion.button>
          </motion.form>
        ) : (
          <motion.div
            className="text-emerald-400 font-mono text-lg"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span className="text-2xl">✓</span> Operator "{name}" registered
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

/** Step 3: Rank Assignment Ceremony — Recruit badge reveal */
const RankAssignment = ({ operatorName, onComplete }: { operatorName: string; onComplete: () => void }) => {
  const [showBadge, setShowBadge] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowBadge(true), 500);
    const t2 = setTimeout(() => {
      setShowConfetti(true);
    }, 1200);
    const t3 = setTimeout(() => setShowDetails(true), 2200);
    const t4 = setTimeout(() => onComplete(), 5500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <UnlockAnimation trigger={showConfetti} />

      <motion.div
        className="w-full max-w-lg text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Badge reveal */}
        <div className="relative mx-auto mb-8">
          <motion.div
            className="flex h-32 w-32 items-center justify-center rounded-full border-2 border-emerald-400/40 bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 mx-auto"
            initial={{ scale: 0, rotate: -30 }}
            animate={showBadge ? { scale: 1, rotate: 0 } : {}}
            transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.3 }}
          >
            <motion.span
              className="text-5xl"
              initial={{ scale: 0 }}
              animate={showBadge ? { scale: 1 } : {}}
              transition={{ delay: 0.6, type: "spring", stiffness: 300 }}
            >
              🪖
            </motion.span>
          </motion.div>

          {/* Pulse rings */}
          {showBadge && (
            <>
              <motion.span
                className="absolute -inset-4 rounded-full border border-emerald-400/20"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.span
                className="absolute -inset-8 rounded-full border border-emerald-400/10"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 0 }}
                transition={{ duration: 2, delay: 0.3, repeat: Infinity, ease: "easeOut" }}
              />
            </>
          )}
        </div>

        {/* Rank announcement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={showBadge ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6 }}
        >
          <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-5 py-1.5 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
              RANK ASSIGNED
            </span>
          </div>

          <h2 className="text-3xl font-bold text-slate-100 mb-2">
            Welcome, {operatorName}
          </h2>
          <p className="text-lg font-mono text-cyan-300 mb-2">
            Rank: <span className="text-emerald-400 font-bold">🪖 Recruit</span>
          </p>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            You have been officially commissioned as a ZeroDay Guardian operator.
            Your journey from Recruit to Elite Guardian begins now.
          </p>
        </motion.div>

        {/* Rank progression preview */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              className="mt-8 p-5 rounded-xl border border-slate-800/40 bg-slate-900/40"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-3">
                Rank Progression Path
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {RANKS.map((rank, i) => (
                  <motion.div
                    key={rank.name}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                      i === 0
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 ring-1 ring-emerald-400/30"
                        : "bg-slate-800/30 text-slate-500 border border-slate-700/30"
                    }`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <span>{rank.icon}</span>
                    <span>{rank.name}</span>
                    {i < RANKS.length - 1 && (
                      <span className="text-slate-600 ml-0.5">→</span>
                    )}
                  </motion.div>
                ))}
              </div>
              <motion.p
                className="mt-4 text-xs text-slate-500 font-mono"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                Complete missions, earn XP, and advance through the ranks.
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

/** Step 4: ZORVIX AI Introduction */
const ZorvixIntro = ({ operatorName, onComplete }: { operatorName: string; onComplete: () => void }) => {
  const [showMessage, setShowMessage] = useState(false);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowMessage(true), 800);
    const t2 = setTimeout(() => setShowButton(true), 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <motion.div
        className="w-full max-w-lg text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {/* Holographic ZORVIX icon */}
        <motion.div
          className="mx-auto mb-8"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
        >
          <div className="relative inline-flex">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 shadow-[0_0_40px_rgba(34,211,238,0.08)]">
              <span className="text-5xl font-bold bg-gradient-to-br from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Z
              </span>
            </div>
            {/* Holographic rotating rings */}
            <motion.span
              className="absolute -inset-3 rounded-full border border-cyan-400/20"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
            <motion.span
              className="absolute -inset-6 rounded-full border border-purple-400/10 border-dashed"
              animate={{ rotate: -360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </motion.div>

        {/* Message */}
        <AnimatePresence>
          {showMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-2xl font-bold text-slate-100 mb-4">
                ZORVIX AI Core Online
              </h2>

              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-6 mb-6 text-left">
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="h-4 w-4 text-cyan-400" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                    ZORVIX v3.2.1 — Personal Cyber Mentor
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  "Welcome, {operatorName}. I am ZORVIX, your personal cyber mentor.
                  I will assess your skills, recommend missions, track your progress,
                  and guide your journey from Recruit to Elite Guardian.
                  Think of me as your tactical AI coach — always available, always focused on your growth."
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono">AI Core synchronized — ready to assist</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Continue button */}
        <AnimatePresence>
          {showButton && (
            <motion.button
              type="button"
              onClick={onComplete}
              className="group inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-8 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white shadow-lg shadow-cyan-500/20 transition-all duration-200 hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] active:scale-[0.98]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={springSnap}
            >
              <Sparkles className="h-4 w-4" />
              Begin Your First Mission
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

/** Step 5: Mission Briefing — final redirect */
const MissionBriefing = ({ operatorName }: { operatorName: string }) => {
  const navigate = useNavigate();

  const briefingLines = [
    { icon: Terminal, text: "Mission 01: Recon Initiation", desc: "Perform your first SYN scan", color: "text-cyan-400" },
    { icon: Zap, text: "AI Mentor Access", desc: "ZORVIX is standing by", color: "text-emerald-400" },
    { icon: Shield, text: "Command Center", desc: "Monitor your progress", color: "text-purple-400" },
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/program/day/1", { replace: true });
    }, 4000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <motion.div
        className="w-full max-w-lg text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-400/30 bg-emerald-500/10"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
        >
          <Trophy className="h-7 w-7 text-emerald-400" />
        </motion.div>

        <h2 className="text-2xl font-bold text-slate-100 mb-2">
          Commissioning Complete
        </h2>
        <p className="text-sm text-slate-400 mb-8">
          Operator {operatorName}, your first mission is ready.
        </p>

        <div className="space-y-3 mb-8">
          {briefingLines.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.text}
                className="flex items-center gap-3 rounded-lg border border-slate-800/40 bg-slate-900/30 p-3.5 text-left"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
              >
                <Icon className={`h-4 w-4 ${item.color} shrink-0`} />
                <div>
                  <p className="text-sm font-medium text-slate-200">{item.text}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.p
          className="text-xs text-slate-500 font-mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          Redirecting to your first operation...
        </motion.p>

        <div className="mt-3 flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
};

// ── Main Component ──

interface OnboardingCeremonyProps {
  /** Called when the entire ceremony is complete */
  onComplete?: () => void;
}

export default function OnboardingCeremony({ onComplete }: OnboardingCeremonyProps) {
  const { operatorName, setOperatorName, completeCeremony, skipCeremony } = useOnboarding();
  const [step, setStep] = useState<CeremonyStep>("boot");
  const [operatorNameFinal, setOperatorNameFinal] = useState("");

  const goToNext = useCallback(() => {
    switch (step) {
      case "boot":
        setStep("identity");
        break;
      case "identity":
        setStep("rank");
        break;
      case "rank":
        setStep("zorvix");
        break;
      case "zorvix":
        setStep("briefing");
        break;
      case "briefing":
        // Final — ceremony is complete
        completeCeremony(operatorNameFinal || operatorName);
        onComplete?.();
        break;
    }
  }, [step, operatorNameFinal, operatorName, completeCeremony, onComplete]);

  const handleIdentityComplete = useCallback((name: string) => {
    setOperatorNameFinal(name);
    setOperatorName(name);
    setStep("rank");
  }, [setOperatorName]);

  const handleSkip = useCallback(() => {
    skipCeremony();
    onComplete?.();
  }, [skipCeremony, onComplete]);

  const stepNames: Record<CeremonyStep, string> = {
    boot: "Commissioning Protocol",
    identity: "Identity Assignment",
    rank: "Rank Commissioning",
    zorvix: "AI Integration",
    briefing: "Mission Briefing",
  };

  const stepNumbers: Record<CeremonyStep, number> = {
    boot: 1,
    identity: 2,
    rank: 3,
    zorvix: 4,
    briefing: 5,
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#050508] overflow-hidden">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] aspect-square rounded-full opacity-[0.08] blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(34, 211, 238, 0.3), transparent 70%)" }}
        />
        <div className="absolute -bottom-[20%] -right-[10%] w-[40%] aspect-square rounded-full opacity-[0.06] blur-[100px]"
          style={{ background: "radial-gradient(circle, rgba(52, 211, 153, 0.2), transparent 70%)" }}
        />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(34, 211, 238, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(34, 211, 238, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Top status bar */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-800/40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-cyan-500/10">
            <Swords className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
            OPERATOR COMMISSIONING
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Step indicator */}
          <div className="hidden sm:flex items-center gap-2">
            {(["boot", "identity", "rank", "zorvix", "briefing"] as CeremonyStep[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-mono font-bold ${
                  stepNumbers[s] <= stepNumbers[step]
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-slate-800/30 text-slate-600 border border-slate-700/30"
                }`}>
                  {i + 1}
                </div>
                {i < 4 && <span className="h-px w-4 bg-slate-800/50" />}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSkip}
            className="font-mono text-[10px] text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-[0.12em]"
          >
            Skip →
          </button>
        </div>
      </div>

      {/* Current step label */}
      <div className="relative z-10 flex items-center justify-center px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-400/60">
          Step {stepNumbers[step]} of 5: {stepNames[step]}
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            {step === "boot" && <BootSequence onComplete={goToNext} />}
            {step === "identity" && (
              <IdentityAssignment onComplete={handleIdentityComplete} />
            )}
            {step === "rank" && (
              <RankAssignment operatorName={operatorNameFinal || operatorName} onComplete={goToNext} />
            )}
            {step === "zorvix" && (
              <ZorvixIntro operatorName={operatorNameFinal || operatorName} onComplete={goToNext} />
            )}
            {step === "briefing" && (
              <MissionBriefing operatorName={operatorNameFinal || operatorName} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
