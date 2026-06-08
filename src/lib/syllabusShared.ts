/**
 * Syllabus Shared Constants — Frontend Mirror
 * ────────────────────────────────────────────
 * Mirrors backend/src/llm/core/executiveContext.mjs so the React app
 * can render the 60-day roadmap, resolve phases, and display telemetry
 * without duplicating the data.
 */

export const ZORVIX_UI = {
  background: "#05070C",
  surface: "#0B111E",
  cyberCyan: "#00F0FF",
  elitePurple: "#A124FF",
  accentGreen: "#00FF88",
  accentRed: "#FF3355",
} as const;

export interface SyllabusPhase {
  id: number;
  name: string;
  dayRange: [number, number];
  vectorTrack: VectorTrack;
  topics: string[];
}

export type VectorTrack = "RECON" | "APPSEC" | "BINARY_PWN" | "REV_ENG";

export const SYLLABUS_PHASES: SyllabusPhase[] = [
  {
    id: 1,
    name: "Recon & Network Core",
    dayRange: [1, 20],
    vectorTrack: "RECON",
    topics: [
      "L3/L4 mapping",
      "Raw socket programming",
      "HTTP protocol telemetry",
      "DNS zone leaks",
      "Shodan / Censys data mining",
      "Wireshark PCAP stream reconstruction",
    ],
  },
  {
    id: 2,
    name: "Web & Application Breaching",
    dayRange: [21, 40],
    vectorTrack: "APPSEC",
    topics: [
      "Advanced OWASP Top 10 logic",
      "Time-Based Blind SQLi",
      "SSRF authority bypass",
      "Cryptographic JWT manipulation",
      "IDOR tampering",
      "Custom Python / Bash fuzzers",
    ],
  },
  {
    id: 3,
    name: "Binary Pwn & Zero-Days",
    dayRange: [41, 60],
    vectorTrack: "BINARY_PWN",
    topics: [
      "Low-level memory architecture",
      "x86/x64 CPU register control (EIP/RIP hijacking)",
      "Stack / Heap Buffer Overflows",
      "Shellcode assembly crafting",
      "ROP chains engineering",
      "ASLR / DEP mitigation bypasses",
      "Kernel isolation",
    ],
  },
];

export interface PhaseResolution {
  phase: SyllabusPhase;
  vectorTrack: VectorTrack;
  themeHex: string;
}

export const resolvePhase = (day: number): PhaseResolution => {
  const clamped = Math.max(1, Math.min(60, Number(day) || 1));
  const phase =
    SYLLABUS_PHASES.find(
      (p) => clamped >= p.dayRange[0] && clamped <= p.dayRange[1]
    ) ?? SYLLABUS_PHASES[0];

  const themeHex =
    phase.vectorTrack === "BINARY_PWN"
      ? ZORVIX_UI.elitePurple
      : ZORVIX_UI.cyberCyan;

  return { phase, vectorTrack: phase.vectorTrack, themeHex };
};

/** Map a day number to its phase index (0-based) for progress display */
export const dayToPhaseIndex = (day: number): number => {
  const clamped = Math.max(1, Math.min(60, Number(day) || 1));
  return SYLLABUS_PHASES.findIndex(
    (p) => clamped >= p.dayRange[0] && clamped <= p.dayRange[1]
  );
};

/** Total days across all phases */
export const TOTAL_DAYS = 60;
