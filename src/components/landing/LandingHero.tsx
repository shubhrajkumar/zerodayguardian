import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, Swords, Terminal, Shield, Zap, Radar, Activity, Cpu, Globe, Network, Wifi } from "lucide-react";
import { motion, useAnimation } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { staggerContainer, staggerItem, tapScale } from "@/lib/animations";

// ── Simulated terminal lines ──
const TERMINAL_LINES = [
  { text: "Initializing ZeroDay Guardian command center...", delay: 500, type: "info" },
  { text: "Loading neural AI core (ZORVIX v3.2.1)...", delay: 1200, type: "info" },
  { text: "AI Core ONLINE — Synchronizing threat feeds...", delay: 2200, type: "success" },
  { text: "Establishing secure uplink [████████░░] 84%", delay: 3200, type: "info" },
  { text: "Uplink established — System ready", delay: 4200, type: "success" },
  { text: "OPERATOR STATUS: Unidentified — Initiate training", delay: 5200, type: "prompt" },
];

// ── Interactive command definitions ──
type CommandHandler = (args: string[], pushLine?: (line: string) => void) => Promise<string[]>;

/** Shared auto-scroll helper used by the command handler and processCommand */
const scrollTerminalBottom = (ref: { current: HTMLDivElement | null }) => {
  requestAnimationFrame(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  });
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const COMMANDS: Record<string, { desc: string; handler: CommandHandler }> = {
  help: {
    desc: "Show available commands",
    handler: async () => ["Available commands: clear, status, scan, deploy"],
  },
  status: {
    desc: "Show system health",
    handler: async () => ["SYSTEM: ONLINE | AGENT: ACTIVE | RANK: RECRUIT"],
  },
  scan: {
    desc: "Scan target subnet",
    handler: async (_args, pushLine) => {
      if (!pushLine) return ["Scanning subnet..."];

      pushLine("Scanning subnet...");
      await delay(1000);

      pushLine("Analyzing vulnerabilities...");
      await delay(1000);

      const criticalCount = Math.floor(Math.random() * 3);
      pushLine(`Scan Complete: ${criticalCount} critical flaws found.`);
      await delay(400);

      return []; // All output was pushed via pushLine
    },
  },
  deploy: {
    desc: "Deploy mission module",
    handler: async () => [
      "DEPLOY: Mission module loaded.",
      "Target environment: sandbox.zerodayguardian.internal",
      "Session token: zdg-••••-••••-••••",
      "Status: Ready. Navigate to /lab to engage.",
    ],
  },
  clear: {
    desc: "Clear the terminal",
    handler: async () => [],
  },
};

const LandingHero = () => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [terminalIndex, setTerminalIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const [currentLine, setCurrentLine] = useState("");
  const [commandInput, setCommandInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [processing, setProcessing] = useState(false);
  const controls = useAnimation();
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVisible(true);
    controls.start("visible");
  }, [controls]);

  // Terminal boot animation
  useEffect(() => {
    if (terminalIndex >= TERMINAL_LINES.length) return;
    const line = TERMINAL_LINES[terminalIndex];
    const timer = setTimeout(() => {
      if (charIndex < line.text.length) {
        setCurrentLine((prev) => prev + line.text[charIndex]);
        setCharIndex((prev) => prev + 1);
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      } else {
        setTerminalOutput((prev) => [...prev, `${line.type === "success" ? "✓" : line.type === "prompt" ? ">" : line.type === "error" ? "✗" : "•"} ${line.text}`]);
        setCurrentLine("");
        setCharIndex(0);
        setTerminalIndex((prev) => prev + 1);
      }
    }, charIndex === 0 ? line.delay : 25 + Math.random() * 15);
    return () => clearTimeout(timer);
  }, [terminalIndex, charIndex]);

  // Cursor blink
  useEffect(() => {
    const interval = setInterval(() => setShowCursor((prev) => !prev), 530);
    return () => clearInterval(interval);
  }, []);

  const isBooted = terminalIndex >= TERMINAL_LINES.length;

  const processCommand = async (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    if (!trimmed) return;

    setProcessing(true);
    setCommandInput("");
    setCommandHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);

    // Echo the command
    const promptLine = `$ ${cmd}`;
    setTerminalOutput((prev) => [...prev, promptLine]);
    scrollTerminalBottom(terminalRef);

    // Parse command
    const parts = trimmed.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    if (command === "clear") {
      setTerminalOutput([]);
      setProcessing(false);
      return;
    }

    const cmdDef = COMMANDS[command];
    if (!cmdDef) {
      setTerminalOutput((prev) => [...prev, `  Unknown command: '${command}'. Type 'help' for available commands.`]);
      scrollTerminalBottom(terminalRef);
      setProcessing(false);
      return;
    }

    // Build the pushLine callback for progressive/animated output
    const pushLine = (line: string) => {
      setTerminalOutput((prev) => [...prev, line]);
      scrollTerminalBottom(terminalRef);
    };

    try {
      const output = await cmdDef.handler(args, pushLine);
      setTerminalOutput((prev) => [...prev, ...output]);
      scrollTerminalBottom(terminalRef);
    } catch {
      setTerminalOutput((prev) => [...prev, `  Error executing command '${command}'.`]);
      scrollTerminalBottom(terminalRef);
    }

    setProcessing(false);
  };

  const handleCommandSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!processing) processCommand(commandInput);
  };

  const focusTerminal = () => {
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCommandInput(commandHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCommandInput("");
        } else {
          setHistoryIndex(newIndex);
          setCommandInput(commandHistory[newIndex]);
        }
      }
    }
  };

  const scrollToSection = () => {
    const el = document.getElementById("career-paths");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const statusItems = [
    { label: "SYSTEM", value: "ONLINE", color: "text-emerald-400", dot: "bg-emerald-400" },
    { label: "AI CORE", value: "ACTIVE", color: "text-cyan-400", dot: "bg-cyan-400" },
    { label: "THREAT LEVEL", value: "GUIDED", color: "text-amber-400", dot: "bg-amber-400" },
    { label: "NETWORK", value: "SECURE", color: "text-emerald-400", dot: "bg-emerald-400" },
  ];

  return (
    <section
      className="relative min-h-screen bg-[#050508] overflow-hidden flex items-center"
      style={{ contain: "layout style" }}
    >
      {/* Premium cyber grid — denser, with perspective mask */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {/* Primary grid layer */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(34, 211, 238, 0.12) 1px, transparent 1px),
              linear-gradient(90deg, rgba(34, 211, 238, 0.12) 1px, transparent 1px)
            `,
            backgroundSize: "24px 24px",
            maskImage: "radial-gradient(ellipse at 50% 30%, black 35%, transparent 72%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black 35%, transparent 72%)",
          }}
        />
        {/* Secondary dot matrix overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(rgba(52, 211, 153, 0.15) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at 50% 50%, black 30%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 50%, black 30%, transparent 70%)",
          }}
        />
      </div>

      {/* CRT scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        aria-hidden="true"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34, 211, 238, 0.04) 2px, rgba(34, 211, 238, 0.04) 4px)",
          backgroundSize: "100% 4px",
          animation: "crt-scan 6s linear infinite",
        }}
      />

      {/* Ambient glows — enhanced with more layers */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-[15%] -left-[8%] w-[55%] aspect-square rounded-full opacity-[0.12] blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(34, 211, 238, 0.35), transparent 70%)" }}
        />
        <div className="absolute -bottom-[15%] -right-[8%] w-[45%] aspect-square rounded-full opacity-[0.08] blur-[100px]"
          style={{ background: "radial-gradient(circle, rgba(52, 211, 153, 0.25), transparent 70%)" }}
        />
        <div className="absolute top-[35%] right-[20%] w-[12%] aspect-square rounded-full opacity-[0.04] blur-[80px]"
          style={{ background: "radial-gradient(circle, rgba(167, 139, 250, 0.3), transparent 70%)" }}
        />
      </div>

      {/* CRT scan line sweep */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.012]"
        style={{
          background: "linear-gradient(180deg, transparent 0%, rgba(34, 211, 238, 0.12) 50%, transparent 100%)",
          backgroundSize: "100% 3px",
          animation: "scan-line 4s linear infinite",
        }}
      />

      <div className={`relative z-10 w-full px-4 py-16 md:py-20 transition-all duration-1000 ${visible ? "opacity-100" : "opacity-0"}`}>
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] items-start"
            variants={staggerContainer}
            initial="hidden"
            animate={controls}
          >
            {/* LEFT COLUMN — Main Content */}
            <div className="space-y-6">
              {/* Live badge with ping */}
              <motion.div variants={staggerItem} className="inline-flex items-center gap-2.5 rounded-full border border-emerald-400/25 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 px-4 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                </span>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  ZORVIX AI Operations Center — Online
                </span>
              </motion.div>

              {/* Headline with cyber presence */}
              <motion.h1
                variants={staggerItem}
                className="text-4xl font-extrabold tracking-[-0.03em] text-slate-100 md:text-5xl lg:text-6xl leading-[1.1]"
              >
                Enter the{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-300 bg-clip-text text-transparent">
                  Cyber Operations
                </span>
                <br />
                Academy
              </motion.h1>

              <motion.p variants={staggerItem} className="text-base leading-relaxed text-slate-400 max-w-xl md:text-lg">
                Not a website. A classified cyber training ecosystem. Real missions,
                AI mentorship, live labs — and a path from Recruit to Elite Guardian.
              </motion.p>

              {/* CTA buttons */}
              <motion.div variants={staggerItem} className="flex flex-col gap-3 sm:flex-row pt-2">
                <motion.button
                  type="button"
                  onClick={() => navigate("/labs/demo-nmap")}
                  className="group relative inline-flex min-h-[52px] min-w-[200px] items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-7 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white shadow-lg shadow-emerald-500/20 transition-all duration-300 active:scale-[0.98] overflow-hidden"
                  whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(52, 211, 153, 0.4)" }}
                  whileTap={tapScale}
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <Terminal className="h-4 w-4 transition-transform group-hover:rotate-12" />
                  Deploy Free Mission
                  <ArrowRight className="h-4 w-4 transition-all group-hover:translate-x-1" />
                </motion.button>
                <motion.button
                  type="button"
                  onClick={scrollToSection}
                  className="group inline-flex min-h-[52px] min-w-[180px] items-center justify-center gap-2.5 rounded-xl border border-slate-700/60 bg-slate-900/40 px-7 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300 transition-all duration-300 active:scale-[0.98]"
                  whileHover={{ scale: 1.02, borderColor: "rgba(34, 211, 238, 0.5)", boxShadow: "0 0 20px rgba(34, 211, 238, 0.08)" }}
                  whileTap={tapScale}
                >
                  <Radar className="h-4 w-4" />
                  Career Paths
                </motion.button>
              </motion.div>

              {/* Value props row */}
              <motion.div variants={staggerItem} className="flex flex-wrap gap-x-8 gap-y-3 pt-2">
                {[
                  { icon: Swords, label: "60+ Missions", sub: "Structured progression" },
                  { icon: Cpu, label: "AI Mentor", sub: "24/7 ZORVIX guidance" },
                  { icon: Shield, label: "Live Labs", sub: "Real sandbox env" },
                  { icon: Zap, label: "Rank System", sub: "Recruit → Elite" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/40 bg-slate-800/30 text-emerald-400">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{item.label}</p>
                      <p className="text-[11px] text-slate-500">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* RIGHT COLUMN — Terminal + System Status */}
            <motion.div variants={staggerItem} className="space-y-4">
              {/* Terminal Window */}
              <div className="rounded-xl border border-slate-800/60 bg-[#050508]/90 backdrop-blur-sm overflow-hidden shadow-[0_0_30px_rgba(34,211,238,0.04)]">
                {/* Terminal header */}
                <div className="flex items-center gap-1.5 border-b border-slate-800/60 px-4 py-2.5 bg-slate-900/50">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                  </div>
                  <span className="ml-2 font-mono text-[10px] text-slate-500 tracking-wider">
                    zdg-terminal — zsh (ZORVIX v3.2.1)
                  </span>
                </div>

                {/* Terminal body */}
                <div
                  ref={terminalRef}
                  className="h-[240px] overflow-y-auto p-4 font-mono text-xs leading-relaxed scrollbar-thin cursor-text"
                  style={{ scrollbarWidth: "thin" }}
                  onClick={focusTerminal}
                >
                  {terminalOutput.map((line, i) => (
                    <div
                      key={i}
                      className={`${
                        line.startsWith("✓")
                          ? "text-emerald-400"
                          : line.startsWith(">")
                          ? "text-cyan-300"
                          : line.startsWith("•")
                          ? "text-slate-400"
                          : line.startsWith("✗")
                          ? "text-red-400"
                          : line.startsWith("$ ")
                          ? "text-cyan-300 font-medium"
                          : "text-slate-400"
                      }`}
                    >
                      <span className="text-slate-600/60 mr-2">[{String(i + 1).padStart(2, "0")}:{String(Math.floor(Math.random() * 60)).padStart(2, "0")}:{String(Math.floor(Math.random() * 60)).padStart(2, "0")}]</span>
                      {line}
                    </div>
                  ))}
                  {currentLine && (
                    <div className="text-cyan-300">
                      <span className="text-slate-600/60 mr-2">[{String(terminalOutput.length + 1).padStart(2, "0")}:{String(new Date().getMinutes()).padStart(2, "0")}:{String(new Date().getSeconds()).padStart(2, "0")}]</span>
                      <span className="text-emerald-400 mr-1">$</span> {currentLine}
                      {showCursor && <span className="text-emerald-400 animate-terminal-blink">▌</span>}
                    </div>
                  )}
                  {isBooted && (
                    <>
                      <div className="mt-2 text-emerald-400 font-semibold animate-fade-in">
                        [SYSTEM] ZeroDay Guardian initialized — awaiting operator
                      </div>
                      {/* Interactive command input — invisible input for keyboard popup */}
                      <form onSubmit={handleCommandSubmit} className="relative mt-1 flex items-center">
                        <span className="text-emerald-400 mr-1.5 shrink-0">$</span>
                        <span className="flex-1 text-cyan-300 font-mono text-xs whitespace-pre-wrap break-all">
                          {commandInput || <span className="text-slate-600">{processing ? "Processing..." : "Type 'help'"}</span>}
                        </span>
                        {!processing && <span className="text-emerald-400 animate-terminal-blink shrink-0">▌</span>}
                        {/* Invisible input that receives all keyboard events — clicking anywhere in the terminal focuses it */}
                        <input
                          ref={inputRef}
                          type="text"
                          value={commandInput}
                          onChange={(e) => setCommandInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          disabled={processing}
                          autoComplete="off"
                          spellCheck={false}
                          aria-label="Terminal command input"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-text"
                        />
                      </form>
                    </>
                  )}
                </div>
              </div>

              {/* System Status Grid */}
              <div className="grid grid-cols-2 gap-2">
                {statusItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-slate-800/50 bg-slate-900/40 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${item.dot} shadow-[0_0_6px_rgba(52,211,153,0.5)] animate-pulse`} />
                      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
                        {item.label}
                      </span>
                    </div>
                    <p className={`mt-1 text-xs font-bold font-mono ${item.color}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Quick stat row */}
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg border border-slate-800/30 bg-slate-900/20 px-3 py-2">
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Current Rank</p>
                  <p className="text-sm font-bold text-cyan-300">🪖 Recruit</p>
                </div>
                <div className="flex-1 rounded-lg border border-slate-800/30 bg-slate-900/20 px-3 py-2">
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Next Mission</p>
                  <p className="text-sm font-bold text-emerald-300">Recon Initiation</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
