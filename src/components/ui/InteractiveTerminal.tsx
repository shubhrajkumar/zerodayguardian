/**
 * InteractiveTerminal — A fully functional Linux/hacker-style terminal component
 * built with native React state and Tailwind CSS.
 *
 * Features:
 *   - Simulated system boot sequence with typing animation
 *   - Keyboard input with real-time command parsing
 *   - Commands: about, status, missions, clear
 *   - Arrow-up/down command history navigation
 *   - Blinking cursor via animate-pulse
 *   - Scrollable output area with auto-scroll
 *   - No third-party terminal libraries
 *
 * Usage:
 *   <InteractiveTerminal className="max-w-xl" />
 */
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Terminal } from "lucide-react";

// ── Boot sequence lines ──
const BOOT_LINES = [
  { text: "Initializing kernel modules...", delay: 300, type: "info" },
  { text: "Loading ZeroDay Guardian v3.2.1", delay: 1100, type: "info" },
  { text: "[  OK  ] Network interface zdg0: 10.0.0.1/24", delay: 2000, type: "success" },
  { text: "[  OK  ] Firewall rules applied — 0 ingress, 3 egress", delay: 2900, type: "success" },
  { text: "[  OK  ] ZORVIX AI core — model v3.2.1 loaded", delay: 3800, type: "success" },
  { text: "[WARN] Threat feed sync: 4 high-priority intel items pending", delay: 4700, type: "warn" },
  { text: "System ready. Type 'help' for available commands.", delay: 5500, type: "prompt" },
];

// ── ASCII art for `about` ──
const ASCII_ART = `
╔══════════════════════════════════╗
║        ZERODAY GUARDIAN          ║
║     Cyber Operations Academy     ║
╠══════════════════════════════════╣
║  ⚔  60+ Combat Missions         ║
║  🤖  ZORVIX AI Mentor (24/7)    ║
║  🧪  Interactive Sandbox Labs   ║
║  🏆  Rank System: Recruit→Elite ║
║  🔬  OSINT Investigations       ║
║  🛡️  SOC Analyst Simulations    ║
╚══════════════════════════════════╝
`;

const ABOUT_SUMMARY = [
  "ZeroDay Guardian is a classified cyber training ecosystem.",
  "Train through real missions, AI mentorship, and live sandbox labs.",
  "From Recon to Exploitation — every skill is earned, not given.",
  "Your path: Recruit → Operator → Tactician → Strategist → Elite Guardian.",
];

// ── Command catalog ──
const COMMANDS: Array<{ name: string; desc: string }> = [
  { name: "help", desc: "Display available commands" },
  { name: "about", desc: "Show ZeroDay Guardian overview with ASCII art" },
  { name: "status", desc: "Display live system telemetry" },
  { name: "missions [filter]", desc: "List missions — filter by phase: recon, appsec, defense, cloud" },
  { name: "clear", desc: "Flush terminal history" },
];

// ── Mission catalog ──
const MISSIONS = [
  { id: 1, name: "Recon Initiation", phase: "Recon", xp: 120 },
  { id: 2, name: "DNS Footprinting", phase: "Recon", xp: 150 },
  { id: 3, name: "Port Scan & Service Enumeration", phase: "Recon", xp: 180 },
  { id: 4, name: "Web App Enumeration", phase: "AppSec", xp: 200 },
  { id: 5, name: "SQL Injection Basics", phase: "AppSec", xp: 250 },
  { id: 6, name: "Cross-Site Scripting (XSS)", phase: "AppSec", xp: 240 },
  { id: 7, name: "SOC Alert Triage", phase: "Defense", xp: 200 },
  { id: 8, name: "Phishing Analysis", phase: "Defense", xp: 220 },
  { id: 9, name: "Incident Response Drill", phase: "Defense", xp: 300 },
  { id: 10, name: "Cloud Enumeration", phase: "Cloud", xp: 260 },
];

// ── Types ──
type BootLineType = "info" | "success" | "warn" | "prompt";

interface BootLine {
  text: string;
  delay: number;
  type: BootLineType;
}

interface InteractiveTerminalProps {
  /** Additional CSS classes for the container */
  className?: string;
  /** Terminal window title shown in the header */
  title?: string;
}

// ── Helpers ──
const scrollToBottom = (ref: { current: HTMLDivElement | null }) => {
  requestAnimationFrame(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  });
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const formatTimestamp = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
};

export default function InteractiveTerminal({
  className = "",
  title = "zdg-terminal",
}: InteractiveTerminalProps) {
  // ── State ──
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [bootIndex, setBootIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [currentTyping, setCurrentTyping] = useState("");
  const [bootComplete, setBootComplete] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [processing, setProcessing] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Cursor blink ──
  useEffect(() => {
    const interval = setInterval(() => setShowCursor((p) => !p), 530);
    return () => clearInterval(interval);
  }, []);

  // ── Boot animation: type out each line character by character ──
  useEffect(() => {
    if (bootIndex >= BOOT_LINES.length) {
      setBootComplete(true);
      return;
    }

    const line = BOOT_LINES[bootIndex];

    if (charIndex < line.text.length) {
      const timer = setTimeout(() => {
        setCurrentTyping((prev) => prev + line.text[charIndex]);
        setCharIndex((prev) => prev + 1);
        scrollToBottom(outputRef);
      }, charIndex === 0 ? line.delay : 18 + Math.random() * 14);
      return () => clearTimeout(timer);
    }

    // Line complete — push to displayedLines
    const prefix =
      line.type === "success"
        ? "[  OK  ]"
        : line.type === "warn"
          ? "[WARN]"
          : line.type === "prompt"
            ? "[SYS]"
            : "[INFO]";

    const color =
      line.type === "success"
        ? "text-emerald-400"
        : line.type === "warn"
          ? "text-amber-400"
          : line.type === "prompt"
            ? "text-cyan-300"
            : "text-slate-400";

    setDisplayedLines((prev) => [
      ...prev,
      `<span class="${color}"><span class="text-slate-600/50">[${formatTimestamp()}]</span> ${prefix} ${line.text}</span>`,
    ]);
    setCurrentTyping("");
    setCharIndex(0);
    setBootIndex((prev) => prev + 1);
    scrollToBottom(outputRef);
  }, [bootIndex, charIndex]);

  // ── Focus input when terminal area is clicked ──
  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  // ── Command processing ──
  const processCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setProcessing(true);
    setCommandInput("");
    setCommandHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);

    // Echo the command (escaped to prevent XSS)
    const echoLine = `<span class="text-cyan-300"><span class="text-slate-600/50">[${formatTimestamp()}]</span> $ ${escapeHtml(trimmed)}</span>`;
    setDisplayedLines((prev) => [...prev, echoLine]);
    scrollToBottom(outputRef);

    const parts = trimmed.toLowerCase().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    // Small delay so the echo renders before output
    await new Promise((r) => setTimeout(r, 60));

    const pushLine = (line: string) => {
      setDisplayedLines((prev) => [...prev, line]);
      scrollToBottom(outputRef);
    };

    switch (command) {
      case "help": {
        pushLine(
          `<span class="text-slate-300"><span class="text-slate-600/50">[${formatTimestamp()}]</span> Available commands:</span>`,
        );
        COMMANDS.forEach(({ name, desc }) => {
          pushLine(
            `<span class="text-slate-400 ml-4"><span class="text-slate-600/50">[${formatTimestamp()}]</span>  <span class="text-emerald-400 font-semibold">${name}</span> — ${desc}</span>`,
          );
        });
        break;
      }

      case "about": {
        // ASCII art
        ASCII_ART.split("\n").forEach((line) => {
          if (line.trim()) {
            pushLine(
              `<span class="text-emerald-400 font-mono whitespace-pre">${line}</span>`,
            );
          }
        });
        // Summary
        ABOUT_SUMMARY.forEach((s) => {
          pushLine(
            `<span class="text-slate-300"><span class="text-slate-600/50">[${formatTimestamp()}]</span> ${s}</span>`,
          );
        });
        break;
      }

      case "status": {
        pushLine(
          `<span class="text-slate-300 font-semibold"><span class="text-slate-600/50">[${formatTimestamp()}]</span> ── System Telemetry ──</span>`,
        );
        const metrics = [
          { label: "Uptime", value: "14d 6h 23m", color: "text-emerald-400" },
          { label: "Latency", value: "24ms", color: "text-cyan-300" },
          { label: "Threat Level", value: "CRITICAL", color: "text-red-400" },
          { label: "Firewall", value: "ACTIVE — 142 rules", color: "text-emerald-400" },
          { label: "AI Uplink", value: "ZORVIX v3.2.1 — ONLINE", color: "text-cyan-300" },
          { label: "Network", value: "10.0.0.1/24 — SECURE", color: "text-emerald-400" },
          { label: "Active Sessions", value: "1 (operator)", color: "text-slate-300" },
          { label: "Memory", value: "2.4 GB / 4.0 GB (60%)", color: "text-amber-400" },
          { label: "CPU Load", value: "23% (idle)", color: "text-emerald-400" },
          { label: "Threat Intel", value: "4 high-priority items", color: "text-red-400" },
        ];
        metrics.forEach((m) => {
          pushLine(
            `<span class="text-slate-400 ml-4"><span class="text-slate-600/50">[${formatTimestamp()}]</span>  <span class="text-slate-500">${m.label}:</span> <span class="${m.color} font-semibold">${m.value}</span></span>`,
          );
        });
        break;
      }

      case "missions": {
        const filter = args[0]?.toLowerCase();
        const filtered = !filter
          ? MISSIONS
          : MISSIONS.filter(
              (m) =>
                m.phase.toLowerCase() === filter ||
                m.name.toLowerCase().includes(filter),
            );

        if (!filtered.length) {
          pushLine(
            `<span class="text-amber-400"><span class="text-slate-600/50">[${formatTimestamp()}]</span> No missions found matching "${escapeHtml(filter || '')}".</span>`,
          );
        } else {
          const phases = [...new Set(filtered.map((m) => m.phase))];
          pushLine(
            `<span class="text-slate-300 font-semibold"><span class="text-slate-600/50">[${formatTimestamp()}]</span> ── Mission Catalog (${filtered.length}) ──</span>`,
          );
          phases.forEach((phase) => {
            pushLine(
              `<span class="text-cyan-300 font-semibold mt-1"><span class="text-slate-600/50">[${formatTimestamp()}]</span>  ▸ ${phase}</span>`,
            );
            filtered
              .filter((m) => m.phase === phase)
              .forEach((m) => {
                pushLine(
                  `<span class="text-slate-400 ml-6"><span class="text-slate-600/50">[${formatTimestamp()}]</span>    #${String(m.id).padStart(2, "0")}  ${m.name.padEnd(35)}  <span class="text-emerald-400">+${m.xp} XP</span></span>`,
                );
              });
          });
        }
        break;
      }

      case "clear": {
        setDisplayedLines([]);
        break;
      }

      default: {
        pushLine(
          `<span class="text-amber-400"><span class="text-slate-600/50">[${formatTimestamp()}]</span> Unknown command: '${escapeHtml(command)}'. Type 'help' for available commands.</span>`,
        );
        break;
      }
    }

    setProcessing(false);
  };

  // ── Event handlers ──
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!processing && commandInput.trim()) processCommand(commandInput);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex =
          historyIndex === -1
            ? commandHistory.length - 1
            : Math.max(0, historyIndex - 1);
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

  return (
    <div
      className={`rounded-xl border border-slate-800/60 bg-[#050508]/95 backdrop-blur-sm overflow-hidden shadow-[0_0_30px_rgba(34,211,238,0.04)] ${className}`}
    >
      {/* ── Terminal header ── */}
      <div className="flex items-center gap-1.5 border-b border-slate-800/60 px-4 py-2.5 bg-slate-900/50">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <div className="ml-2 flex items-center gap-2 flex-1 min-w-0">
          <Terminal className="h-3 w-3 shrink-0 text-slate-500" />
          <span className="font-mono text-[10px] text-slate-500 tracking-wider truncate">
            {title} — zsh (ZORVIX v3.2.1)
          </span>
        </div>
      </div>

      {/* ── Terminal output body ── */}
      <div
        ref={outputRef}
        className="h-[300px] overflow-y-auto p-4 font-mono text-xs leading-relaxed cursor-text scrollbar-thin"
        style={{ scrollbarWidth: "thin" }}
        onClick={handleTerminalClick}
      >
        {/* Rendered output lines (using dangerouslySetInnerHTML for colored output) */}
        {displayedLines.map((line, i) => (
          <div key={i} dangerouslySetInnerHTML={{ __html: line }} />
        ))}

        {/* Current typing line during boot */}
        {!bootComplete && currentTyping && (
          <div className="text-slate-300">
            <span className="text-slate-600/50">[{formatTimestamp()}]</span>{" "}
            [INFO] {currentTyping}
            {showCursor && <span className="text-emerald-400 animate-pulse ml-0.5">▌</span>}
          </div>
        )}

        {/* Boot complete — show command prompt */}
        {bootComplete && (
          <>
            <form onSubmit={handleSubmit} className="relative mt-2 flex items-center">
              <span className="text-slate-600/50 mr-1.5 shrink-0">
                [{formatTimestamp()}]
              </span>
              <span className="text-emerald-400 mr-1.5 shrink-0 font-bold">$</span>
              <span className="flex-1 text-cyan-300 font-mono text-xs whitespace-pre-wrap break-all">
                {commandInput || (
                  <span className="text-slate-600">
                    {processing ? "Processing..." : "Type 'help'"}
                  </span>
                )}
              </span>
              {!processing && showCursor && (
                <span className="text-emerald-400 animate-pulse shrink-0 ml-0.5">▌</span>
              )}
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
                className="absolute inset-0 h-full w-full cursor-text opacity-0"
              />
            </form>
          </>
        )}
      </div>
    </div>
  );
}
