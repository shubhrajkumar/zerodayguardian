/**
 * DemoNmapLab — Free interactive Nmap scan simulation for unregistered visitors.
 *
 * Cyber Rationale: Free demo builds trust → converts visitors to registered users.
 * No backend required — all scan logic is client-side simulation with realistic
 * terminal output, typewriter effects, and ethical disclaimers.
 */
import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, Cpu, Globe, Loader2, Network, Shield, Terminal, XCircle } from "lucide-react";
import { sanitize } from "@/lib/utils";

// ── Types ──
interface PortResult {
  port: number;
  service: string;
  state: "open" | "filtered" | "closed";
}

interface ScanResult {
  ports: PortResult[];
  os: string;
  timestamp: string;
  hostname: string;
  ip: string;
  latency: number;
}

// ── Mock scan logic ──
const MOCK_PORT_DB: Record<string, Array<{ port: number; service: string; state: "open" | "filtered" | "closed" }>> = {
  default: [
    { port: 22, service: "SSH", state: "open" },
    { port: 80, service: "HTTP", state: "open" },
    { port: 443, service: "HTTPS", state: "open" },
    { port: 3306, service: "MySQL", state: "filtered" },
    { port: 8080, service: "HTTP-Proxy", state: "closed" },
  ],
  "192.168": [
    { port: 22, service: "SSH", state: "open" },
    { port: 53, service: "DNS", state: "open" },
    { port: 80, service: "HTTP", state: "open" },
    { port: 443, service: "HTTPS", state: "open" },
    { port: 445, service: "SMB", state: "filtered" },
    { port: 3306, service: "MySQL", state: "closed" },
    { port: 8443, service: "HTTPS-Alt", state: "filtered" },
  ],
  "10.0": [
    { port: 22, service: "SSH", state: "open" },
    { port: 80, service: "HTTP", state: "open" },
    { port: 389, service: "LDAP", state: "open" },
    { port: 443, service: "HTTPS", state: "filtered" },
    { port: 636, service: "LDAPS", state: "open" },
    { port: 3389, service: "RDP", state: "filtered" },
  ],
};

const OS_SIGNATURES = ["Linux 5.15.x", "Linux 6.8.x", "Windows Server 2022", "FreeBSD 13.x", "macOS Sonoma 14.x"];

const mockScan = async (ip: string): Promise<ScanResult> => {
  const prefix = Object.keys(MOCK_PORT_DB).find((k) => ip.startsWith(k)) || "default";
  const ports = MOCK_PORT_DB[prefix];
  const os = OS_SIGNATURES[Math.floor(Math.random() * OS_SIGNATURES.length)];
  const latency = Math.round(45 + Math.random() * 120);

  // Simulate network delay (1.5-3s)
  await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1500));

  return {
    ports,
    os,
    timestamp: new Date().toISOString(),
    hostname: `host-${ip.replace(/\./g, "-")}.unknown.local`,
    ip,
    latency,
  };
};

// ── Terminal output lines for simulation ──
const SCAN_PHASES = [
  { text: "Initializing Nmap 7.95 scan engine...", delay: 300 },
  { text: "Loading protocol database...", delay: 400 },
  { text: "Resolving hostname...", delay: 500 },
  { text: "Starting SYN Stealth Scan...", delay: 600 },
  { text: "Scanning 1000 ports...", delay: 800 },
  { text: "Probing open ports for service versions...", delay: 700 },
];

// ── IP validation regex ──
const IP_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

const validateIP = (ip: string): string | null => {
  const match = ip.match(IP_REGEX);
  if (!match) return "Invalid IP format. Use dotted decimal (e.g., 192.168.1.1)";
  const octets = match.slice(1).map(Number);
  if (octets.some((o) => o > 255)) return "Each octet must be 0-255";
  return null;
};

// ── Port state icon ──
const PortStateIcon = ({ state }: { state: PortResult["state"] }) => {
  switch (state) {
    case "open":
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
    case "filtered":
      return <AlertCircle className="h-3.5 w-3.5 text-amber-400" />;
    default:
      return <XCircle className="h-3.5 w-3.5 text-slate-500" />;
  }
};

// ── Main Component ──
export default function DemoNmapLab() {
  const [targetIP, setTargetIP] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Reset state for new scan
  const resetScan = useCallback(() => {
    setScanResult(null);
    setTerminalLines([]);
    setShowExplanation(false);
    setError(null);
  }, []);

  // Handle scan submission
  const handleScan = useCallback(async () => {
    const trimmed = targetIP.trim();
    const validationError = validateIP(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    resetScan();
    setScanning(true);

    // Start typewriter terminal effect
    for (let i = 0; i < SCAN_PHASES.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, SCAN_PHASES[i].delay));
      setTerminalLines((prev) => [...prev, `$ ${SCAN_PHASES[i].text}`]);
    }

    // Run the mock scan
    try {
      const result = await mockScan(trimmed);
      setTerminalLines((prev) => [
        ...prev,
        `$ Scan complete — ${result.ports.length} ports identified`,
        `$ OS fingerprint: ${result.os}`,
        `$ Latency: ${result.latency}ms`,
      ]);
      setScanResult(result);
    } catch {
      setTerminalLines((prev) => [...prev, "$ ERROR: Scan failed unexpectedly"]);
    } finally {
      setScanning(false);
    }
  }, [targetIP, resetScan]);

  // Open port count
  const openPorts = scanResult?.ports.filter((p) => p.state === "open").length ?? 0;
  const filteredPorts = scanResult?.ports.filter((p) => p.state === "filtered").length ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-cyan-300">
          <Terminal className="h-3 w-3" />
          Free Demo Lab
        </div>
        <h1 className="text-3xl font-bold text-white">Nmap Port Scanner</h1>
        <p className="mt-2 text-sm text-slate-400">
          Experience ZeroDay Guardian's interactive labs — no account required.
          Enter an IP address below to run a simulated port scan.
        </p>
      </div>

      {/* Input Section */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="target-ip" className="mb-1.5 block text-xs font-medium text-slate-400">
              Target IP Address
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="target-ip"
                type="text"
                value={targetIP}
                onChange={(e) => {
                  setTargetIP(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !scanning) handleScan();
                }}
                placeholder="e.g., 192.168.1.1"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20"
                disabled={scanning}
                aria-label="Target IP address"
              />
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1.5 text-xs text-red-400"
              >
                {error}
              </motion.p>
            )}
          </div>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning || !targetIP.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 text-sm font-semibold text-black transition-all duration-200 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40 touch-target"
            aria-label="Run scan"
          >
            {scanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Network className="h-4 w-4" />
                Scan
              </>
            )}
          </button>
        </div>

        {/* Quick IP suggestions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Quick:</span>
          {["192.168.1.1", "10.0.0.1", "8.8.8.8"].map((ip) => (
            <button
              key={ip}
              type="button"
              onClick={() => {
                setTargetIP(ip);
                setError(null);
              }}
              className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-slate-400 transition-colors hover:border-cyan-400/30 hover:text-cyan-300 touch-target"
            >
              {ip}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Output */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e17]">
        <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
          <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">terminal — nmap scan</span>
        </div>
        <div ref={terminalRef} className="max-h-64 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
          {/* Static initial line */}
          <p className="text-emerald-400">$ nmap -sS -sV {targetIP || "<target>"}</p>

          {/* Animated scan phases */}
          <AnimatePresence>
            {terminalLines.map((line, i) => (
              <motion.p
                key={`${line}-${i}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className={line.startsWith("$ ERROR") ? "text-red-400" : "text-cyan-300/85"}
              >
                {sanitize(line)}
              </motion.p>
            ))}
          </AnimatePresence>

          {/* Blinking cursor when scanning */}
          {scanning && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="inline-block h-3 w-2 bg-cyan-400"
            />
          )}

          {/* Empty state */}
          {!scanning && terminalLines.length === 0 && (
            <p className="text-slate-600">Awaiting target input...</p>
          )}
        </div>
      </div>

      {/* Results Cards */}
      <AnimatePresence>
        {scanResult && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-[10px] uppercase tracking-wider text-emerald-400">Open Ports</p>
                <p className="mt-1 text-2xl font-bold text-emerald-300">{openPorts}</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-[10px] uppercase tracking-wider text-amber-400">Filtered</p>
                <p className="mt-1 text-2xl font-bold text-amber-300">{filteredPorts}</p>
              </div>
              <div className="rounded-xl border border-slate-500/20 bg-slate-500/5 p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Latency</p>
                <p className="mt-1 text-2xl font-bold text-slate-300">{scanResult.latency}ms</p>
              </div>
            </div>

            {/* Ports Table */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03]">
              <div className="border-b border-white/8 px-4 py-3">
                <p className="text-xs font-semibold text-white">Discovered Ports</p>
              </div>
              <div className="divide-y divide-white/5">
                {scanResult.ports.map((port) => (
                  <div key={port.port} className="flex items-center gap-3 px-4 py-3">
                    <PortStateIcon state={port.state} />
                    <span className="w-16 font-mono text-sm font-medium text-white">{port.port}</span>
                    <span className="flex-1 text-sm text-slate-300">{port.service}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        port.state === "open"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : port.state === "filtered"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-slate-500/10 text-slate-400"
                      }`}
                    >
                      {port.state}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* OS Detection */}
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <Cpu className="h-4 w-4 text-purple-400" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">OS Fingerprint</p>
                <p className="text-sm font-medium text-purple-300">{scanResult.os}</p>
              </div>
            </div>

            {/* Explain This Button */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowExplanation(!showExplanation)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300 transition-colors hover:border-cyan-400/30 hover:text-cyan-300 touch-target"
              >
                <Shield className="h-4 w-4" />
                {showExplanation ? "Hide Explanation" : "Explain This"}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetScan();
                  setTargetIP("");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300 transition-colors hover:border-white/20 touch-target"
              >
                <Terminal className="h-4 w-4" />
                New Scan
              </button>
            </div>

            {/* Explanation Panel */}
            <AnimatePresence>
              {showExplanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-xl border border-cyan-500/20 bg-cyan-500/5"
                >
                  <div className="p-4">
                    <h3 className="mb-2 text-sm font-semibold text-cyan-300">What does this mean?</h3>
                    <ul className="space-y-2 text-xs leading-relaxed text-slate-300">
                      <li>
                        <strong className="text-emerald-400">Open ports</strong> — Services actively listening.
                        Attackers may target these for exploitation.
                      </li>
                      <li>
                        <strong className="text-amber-400">Filtered ports</strong> — A firewall or ACL is blocking
                        probes. These may be open but hidden.
                      </li>
                      <li>
                        <strong className="text-slate-400">Closed ports</strong> — No service listening. Low risk.
                      </li>
                      <li>
                        <strong className="text-purple-400">OS fingerprinting</strong> — Nmap uses TCP/IP stack
                        behavior to guess the operating system.
                      </li>
                    </ul>
                    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                      <p className="text-[11px] text-amber-300">
                        ⚠️ This is a <strong>simulation</strong>. No real scan is performed. Use these results to
                        understand how Nmap works before using it on authorized targets only.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state (no results) */}
      {!scanning && !scanResult && terminalLines.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/8 p-8 text-center">
          <Terminal className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-500">Enter an IP address and click Scan to see results</p>
        </div>
      )}

      {/* CTA to register */}
      {!scanning && (
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            Like this lab?{" "}
            <a href="/auth" className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300">
              Create a free account
            </a>{" "}
            to access 60+ real labs, missions, and AI mentorship.
          </p>
        </div>
      )}
    </div>
  );
}
