/**
 * DemoNmapLab — Free interactive Nmap scan for unregistered visitors.
 *
 * Fetches live scan data from the backend POST /api/tools/portscan endpoint.
 * No account required — demo converts visitors to registered users.
 *
 * Cyber Rationale: Demonstrating real security tooling (with consent) builds
 * trust and educational credibility more effectively than mock simulations.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Globe,
  Loader2,
  Network,
  Search,
  Shield,
  Target,
  Terminal,
  XCircle,
} from "lucide-react";
import { sanitize } from "@/lib/utils";

// ── Constants ──

const API_PATH = "/api/tools/portscan";

/** 30-second ceiling for the backend scan request */
const SCAN_TIMEOUT_MS = 30_000;

/** Terminal phase messages streamed during the scan lifecycle */
const TERMINAL_PHASES = [
  "Initialising Nmap 7.95 scan engine...",
  "Loading protocol database...",
  "Resolving hostname via DNS...",
  "Initiating TCP connect scan on 23 common ports...",
  "Probing open ports for service banners...",
];

// ── Types ──

type PortState = "open" | "filtered" | "closed";

interface PortResult {
  port: number;
  service: string;
  state: PortState;
  latencyMs: number | null;
}

interface ScanResponse {
  status: string;
  target: string;
  scanned: number;
  open: number;
  filtered: number;
  closed: number;
  results: PortResult[];
  scanDurationMs: number;
}

// ── Helpers ──

/**
 * Accept either a dotted-decimal IPv4 address or a hostname.
 * If it looks like an IP we do a basic octet-range check;
 * hostnames are delegated to the backend DNS resolver.
 */
const TARGET_REGEX =
  /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;

const validateTarget = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return "Target is required.";

  const ipMatch = trimmed.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  );
  if (ipMatch) {
    const octets = ipMatch.slice(1).map(Number);
    if (octets.some((o) => o > 255))
      return "Each IP octet must be 0–255.";
    return null;
  }

  // Hostname check
  if (!TARGET_REGEX.test(trimmed))
    return "Invalid target — enter a valid IP address or hostname.";

  return null;
};

const normaliseTarget = (target: string): string =>
  target
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\s/g, "");

// ── Sub-components ──

const PortStateIcon = ({ state }: { state: PortState }) => {
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
  const navigate = useNavigate();
  const [targetRaw, setTargetRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  // ── Auto-scroll terminal on new lines ──
  useEffect(() => {
    if (!terminalRef.current) return;
    terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalLines]);

  // ── Reset scan state ──
  const resetScan = useCallback(() => {
    setScanResult(null);
    setTerminalLines([]);
    setShowExplanation(false);
    setError(null);
  }, []);

  // ── Run scan ──
  const handleScan = useCallback(async () => {
    const raw = targetRaw.trim();
    const validationError = validateTarget(raw);
    if (validationError) {
      setError(validationError);
      // Also log the error to the terminal as requested
      setTerminalLines([
        `$ nmap -sT -sV ${targetRaw.trim()}`,
        `[!] ERROR: Invalid Target Ingress Structure — ${validationError}`,
      ]);
      return;
    }

    setError(null);
    resetScan();
    setScanning(true);

    const target = normaliseTarget(raw);
    const lines: string[] = [
      `$ nmap -sT -sV ${target}`,
      "  Scanning target, establishing uplink...",
    ];
    setTerminalLines([...lines]);

    // ── AbortController for timeout ──
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

    try {
      // Stream phase messages with realistic timing
      for (let i = 0; i < TERMINAL_PHASES.length; i++) {
        await new Promise<void>((resolve) =>
          setTimeout(() => {
            lines.push(`  ${TERMINAL_PHASES[i]}`);
            setTerminalLines([...lines]);
            resolve();
          }, 250 + i * 180)
        );
      }

      lines.push("  Connecting to backend scan service...");
      setTerminalLines([...lines]);

      const res = await fetch(API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, group: "all" }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        const backendMsg =
          body?.error ||
          (res.status === 429
            ? "Rate limited — too many scans. Please wait and retry."
            : `Backend returned status ${res.status}`);
        lines.push(`[!] CRITICAL: ${backendMsg}`);
        setTerminalLines([...lines]);
        return;
      }

      const data: ScanResponse = await res.json();
      lines.push(
        `  Scan complete — ${data.scanned} ports evaluated in ${data.scanDurationMs}ms`,
        `  ${data.open} open  ·  ${data.filtered} filtered  ·  ${data.closed} closed`
      );
      setTerminalLines([...lines]);
      setScanResult(data);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        lines.push(
          "[!] CRITICAL: Outpost Connection Timeout. Backend Uplink Severed."
        );
      } else {
        lines.push(
          "[!] ERROR: Invalid Target Ingress Structure — check target and retry."
        );
      }
      setTerminalLines([...lines]);
    } finally {
      setScanning(false);
    }
  }, [targetRaw, resetScan]);

  // ── Derived values ──
  const openPorts = scanResult?.open ?? 0;
  const filteredPorts = scanResult?.filtered ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* ── Header ── */}
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-cyan-300">
          <Terminal className="h-3 w-3" />
          Free Demo Lab
        </div>
        <h1 className="text-3xl font-bold text-white">Nmap Port Scanner</h1>
        <p className="mt-2 text-sm text-slate-400">
          Experience ZeroDay Guardian's live port scanner — no account required.
          Enter an IP address or hostname below to run a real TCP connect scan.
        </p>
      </div>

      {/* ── Input Section ── */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="target-ip"
              className="mb-1.5 block text-xs font-medium text-slate-400"
            >
              Target IP or Hostname
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="target-ip"
                type="text"
                value={targetRaw}
                onChange={(e) => {
                  setTargetRaw(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !scanning) handleScan();
                }}
                placeholder="e.g., scanme.nmap.org"
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
            disabled={scanning || !targetRaw.trim()}
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
                <Search className="h-4 w-4" />
                Scan
              </>
            )}
          </button>
        </div>

        {/* Quick target suggestions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Quick:
          </span>
          {["scanme.nmap.org", "192.168.1.1", "example.com"].map((target) => (
            <button
              key={target}
              type="button"
              onClick={() => {
                setTargetRaw(target);
                setError(null);
              }}
              className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-slate-400 transition-colors hover:border-cyan-400/30 hover:text-cyan-300 touch-target"
            >
              {target}
            </button>
          ))}
        </div>
      </div>

      {/* ── Terminal Output ── */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e17]">
        <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
          <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
            terminal — nmap scan
          </span>
        </div>
        <div
          ref={terminalRef}
          className="max-h-64 overflow-y-auto p-4 font-mono text-xs leading-relaxed"
        >
          {/* First line: the nmap command */}
          {!scanning && terminalLines.length === 0 && !scanResult ? (
            <p className="text-emerald-400">
              $ nmap -sT -sV {"<target>"}
            </p>
          ) : null}

          {/* Animated terminal lines */}
          <AnimatePresence>
            {terminalLines.map((line, i) => (
              <motion.p
                key={`${line}-${i}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className={
                  line.startsWith("[!] CRITICAL")
                    ? "text-red-400 font-semibold"
                    : line.startsWith("[!] ERROR")
                      ? "text-red-400"
                      : line.startsWith("$")
                        ? "text-emerald-400"
                        : "text-cyan-300/85"
                }
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
          {!scanning && terminalLines.length === 0 && !scanResult && (
            <p className="text-slate-600">Awaiting target input...</p>
          )}
        </div>
      </div>

      {/* ── Results ── */}
      <AnimatePresence>
        {scanResult && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-[10px] uppercase tracking-wider text-emerald-400">
                  Open Ports
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-300">
                  {openPorts}
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-[10px] uppercase tracking-wider text-amber-400">
                  Filtered
                </p>
                <p className="mt-1 text-2xl font-bold text-amber-300">
                  {filteredPorts}
                </p>
              </div>
              <div className="rounded-xl border border-slate-500/20 bg-slate-500/5 p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">
                  Duration
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-300">
                  {scanResult.scanDurationMs}ms
                </p>
              </div>
            </div>

            {/* OS fingerprinting note */}
            <div className="flex items-center gap-3 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3">
              <Cpu className="h-4 w-4 text-purple-400" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  OS Fingerprint
                </p>
                <p className="text-sm font-medium text-purple-300">
                  TCP connect scan — OS detection requires privileged SYN scan
                </p>
              </div>
            </div>

            {/* Ports table */}
            {scanResult.results.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03]">
                <div className="border-b border-white/8 px-4 py-3">
                  <p className="text-xs font-semibold text-white">
                    Discovered Ports
                  </p>
                </div>
                <div className="divide-y divide-white/5">
                  {scanResult.results
                    .filter((p) => p.state !== "closed")
                    .map((port) => (
                      <div
                        key={port.port}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <PortStateIcon state={port.state} />
                        <span className="w-16 font-mono text-sm font-medium text-white">
                          {port.port}
                        </span>
                        <span className="flex-1 text-sm text-slate-300">
                          {port.service}
                        </span>
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
                        <span className="w-14 text-right font-mono text-[10px] text-slate-500">
                          {port.latencyMs !== null
                            ? `${port.latencyMs}ms`
                            : "—"}
                        </span>
                      </div>
                    ))}
                  {scanResult.results.filter((p) => p.state !== "closed")
                    .length === 0 && (
                    <p className="px-4 py-6 text-center text-xs text-slate-500">
                      All 23 common ports returned closed or filtered.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
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
                  setTargetRaw("");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300 transition-colors hover:border-white/20 touch-target"
              >
                <Terminal className="h-4 w-4" />
                New Scan
              </button>
            </div>

            {/* Explanation panel */}
            <AnimatePresence>
              {showExplanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-xl border border-cyan-500/20 bg-cyan-500/5"
                >
                  <div className="p-4">
                    <h3 className="mb-2 text-sm font-semibold text-cyan-300">
                      What does this mean?
                    </h3>
                    <ul className="space-y-2 text-xs leading-relaxed text-slate-300">
                      <li>
                        <strong className="text-emerald-400">Open ports</strong>{" "}
                        — Services actively listening. Attackers may target
                        these for exploitation.
                      </li>
                      <li>
                        <strong className="text-amber-400">
                          Filtered ports
                        </strong>{" "}
                        — A firewall or ACL is blocking probes. These may be
                        open but hidden.
                      </li>
                      <li>
                        <strong className="text-slate-400">Closed ports</strong>{" "}
                        — No service listening. Low risk.
                      </li>
                      <li>
                        <strong className="text-purple-400">
                          OS fingerprinting
                        </strong>{" "}
                        — Requires privileged (SYN) scan. Our TCP connect scan
                        identifies open services but cannot reliably detect the
                        OS.
                      </li>
                    </ul>
                    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                      <p className="text-[11px] text-amber-300">
                        ⚠️ Only scan targets you own or have explicit written
                        permission to test. Unauthorised scanning may violate
                        computer fraud laws.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty state ── */}
      {!scanning && !scanResult && terminalLines.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/8 p-8 text-center">
          <Terminal className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-500">
            Enter an IP address or hostname and click Scan to see results
          </p>
        </div>
      )}

      {/* ── Conversion section ── */}
      {!scanning && (
        <div className="mt-8 space-y-4">
          {/* Main CTA banner */}
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 p-6 text-center">
            <p className="text-lg font-bold text-white">
              Ready to Go Deeper?
            </p>
            <p className="mt-1 text-sm text-slate-400">
              This was just one lab. Unlock 60 missions, AI mentorship, and a
              complete cyber security learning system.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/demo/assessment")}
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-2 text-xs font-semibold text-cyan-300 transition-all duration-200 hover:border-cyan-400/50 active:scale-[0.98]"
              >
                <Target className="h-3.5 w-3.5" />
                Find Your Path
              </button>
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-black transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Shield className="h-4 w-4" />
                Create Free Account
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Already have an account?{" "}
              <a
                href="/auth"
                className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
              >
                Sign in
              </a>
            </p>
          </div>

          {/* Secondary CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/demo/roadmap")}
              className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-400 transition-colors hover:border-cyan-400/30 hover:text-cyan-300"
            >
              <Terminal className="h-3 w-3" />
              View Full 60-Mission Roadmap
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
