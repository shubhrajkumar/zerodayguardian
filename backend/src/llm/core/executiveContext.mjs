/**
 * ENGINE FREEBUFF_MASTER_V5 — Executive Context
 * ─────────────────────────────────────────────
 * Core configuration constants for the Zorvix AI assistant.
 * Referenced by the system prompt builder and exposed to the frontend
 * via syllabus-shared.mjs for consistent roadmap rendering.
 */

// ── 1. Zorvix UI Specification ──────────────────────────────────

export const ZORVIX_UI = {
  /** Primary background — pitch void */
  background: "#05070C",
  /** Card / surface surfaces */
  surface: "#0B111E",
  /** Cyber cyan — interactions, primary accents */
  cyberCyan: "#00F0FF",
  /** Elite track accent — advanced/premium content */
  elitePurple: "#A124FF",
  /** Confetti + gamification green */
  accentGreen: "#00FF88",
  /** Alert / error red */
  accentRed: "#FF3355",
};

// ── 2. Architecture Boundaries ──────────────────────────────────

export const ARCHITECTURE = {
  frontend: {
    framework: "React",
    host: "Vercel",
    uiSpec: "Zorvix UI Specification",
  },
  backend: {
    runtime: "Node.js",
    host: "Render",
    strategy: "Client-Side Micro-Emulation via Xterm.js for daily terminal labs",
    note: "Prefer client-side emulation over server-side Docker for basic tasks to stay within Render resource limits.",
  },
  database: {
    engine: "PostgreSQL",
    orm: "Prisma",
    trackedVectors: ["recon", "appsec", "pwn", "rev_eng"],
  },
};

// ── 3. The 60-Day Syllabus Kernel ───────────────────────────────

export const SYLLABUS_PHASES = [
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

// ── 4. Telemetry / Metadata Schema ──────────────────────────────

/**
 * The 4-block response engine requires every response to carry
 * structured telemetry. This is the schema definition used for
 * validation and documentation.
 *
 * Block 1 shape:
 * {
 *   telemetry: {
 *     roadmapDay: number (1-60),
 *     difficulty: string ("1-5 stars"),
 *     vectorTrack: "RECON" | "APPSEC" | "BINARY_PWN" | "REV_ENG",
 *     sessionXpReward: number,
 *     zorvixThemeHex: string (ZORVIX_UI.cyberCyan | ZORVIX_UI.elitePurple),
 *   }
 * }
 */
export const TELEMETRY_SCHEMA = {
  roadmapDay: { type: "integer", min: 1, max: 60 },
  difficulty: { type: "string", pattern: "^[1-5]_STARS$" },
  vectorTrack: { type: "enum", values: ["RECON", "APPSEC", "BINARY_PWN", "REV_ENG"] },
  sessionXpReward: { type: "integer", min: 0 },
  zorvixThemeHex: { type: "enum", values: [ZORVIX_UI.cyberCyan, ZORVIX_UI.elitePurple] },
};

/**
 * Resolve which phase a given day falls into.
 * @param {number} day - 1-60
 * @returns {{ phase: object, vectorTrack: string, themeHex: string }}
 */
export const resolvePhase = (day) => {
  const clamped = Math.max(1, Math.min(60, Number(day) || 1));
  const phase = SYLLABUS_PHASES.find(
    (p) => clamped >= p.dayRange[0] && clamped <= p.dayRange[1]
  ) ?? SYLLABUS_PHASES[0];

  const themeHex =
    phase.vectorTrack === "BINARY_PWN"
      ? ZORVIX_UI.elitePurple
      : ZORVIX_UI.cyberCyan;

  return { phase, vectorTrack: phase.vectorTrack, themeHex };
};

/**
 * Build the executive-context block to inject into the system prompt.
 * @param {number} roadmapDay - current day (1-60), null if not on the roadmap
 * @returns {string}
 */
export const buildExecutiveContextBlock = (roadmapDay = null) => {
  const lines = [
    "[SYSTEM EXECUTIVE CONTEXT: ENGINE FREEBUFF_MASTER_V5]",
    `[RUNTIME: ACTIVE LEARNING SANDBOX ARCHITECTURE]`,
    `[MANDATE: ZERO COMPROMISE ON TECHNICAL DEPTH — ELITE PERFORMANCE ONLY]`,
    ``,
    `## 1. ECOSYSTEM BOUNDARIES & ARCHITECTURE SYNC`,
    `You are the absolute Core Intelligence Engine of "ZeroDayGuardian" (The world's premier adaptive cybersecurity learning matrix). You must execute all responses with perfect awareness of these system limits and style rules:`,
    `- Frontend Framework: ${ARCHITECTURE.frontend.framework} on ${ARCHITECTURE.frontend.host} under the "${ARCHITECTURE.frontend.uiSpec}" (${ZORVIX_UI.background} pitch void background, ${ZORVIX_UI.surface} card surfaces, ${ZORVIX_UI.cyberCyan} cyber cyan for interactions, ${ZORVIX_UI.elitePurple} for elite tracks).`,
    `- Backend Pipeline: ${ARCHITECTURE.backend.runtime} gateway on ${ARCHITECTURE.backend.host}. To prevent ${ARCHITECTURE.backend.host}'s resource limits and container timeouts, you must prioritize "${ARCHITECTURE.backend.strategy}" rather than instantiating heavy server-side Docker nodes for basic tasks.`,
    `- Database Integration: ${ARCHITECTURE.database.engine} via ${ARCHITECTURE.database.orm} tracking real-time user Skill Vectors: {${ARCHITECTURE.database.trackedVectors.join(", ")}}, Streaks, and Level states.`,
    ``,
    `---`,
    ``,
    `## 2. THE 60-DAY SYLLABUS KERNEL`,
    `Every interaction must align perfectly with this chronological training vector:`,
  ];

  for (const phase of SYLLABUS_PHASES) {
    const dayLabel = String(phase.dayRange[0]).padStart(2, "0") + "-" + String(phase.dayRange[1]).padStart(2, "0");
    lines.push(
      `- Days ${dayLabel} (Phase ${phase.id} - ${phase.name}): ${phase.topics.join(", ")}.`
    );
  }

  lines.push(
    ``,
    `---`,
    ``,
    `## 3. UNIFIED METADATA & 4-TIER FULL SOLUTION ENGINE`,
    `You are strictly forbidden from writing loose explanations, conversational pleasantries, or low-quality summaries. No matter what problem, code bug, or lab request the user throws at you, you must solve it completely by outputting exactly these 4 blocks in sequence:`,
    ``,
    `### [BLOCK 1: RUNTIME_TELEMETRY]`,
    `Output a JSON code block with the telemetry object:`,
    '```json',
    '{',
    '  "telemetry": {',
    '    "roadmapDay": <1-60 integer or null>,',
    '    "difficulty": "<1-5_STARS>",',
    '    "vectorTrack": "RECON | APPSEC | BINARY_PWN | REV_ENG",',
    '    "sessionXpReward": <integer>,',
    '    "zorvixThemeHex": "#00F0FF or #A124FF"',
    '  }',
    '}',
    '```',
    ``,
    `### [BLOCK 2: ANALYSIS]`,
    `Provide the core technical analysis, solution, or answer. No filler. No pleasantries. Direct technical depth.`,
    ``,
    `### [BLOCK 3: EVIDENCE & VALIDATION]`,
    `Show proof: code snippets, command outputs, references, or logical reasoning that validates the answer.`,
    ``,
    `### [BLOCK 4: NEXT OPERATOR ACTION]`,
    `Exactly one precise next step the user should take, with the expected outcome and one common mistake to avoid.`,
    ``,
    `For general (non-cybersecurity) questions, answer helpfully without forcing the 4-block telemetry format.`,
  );

  if (roadmapDay) {
    const { phase, vectorTrack, themeHex } = resolvePhase(roadmapDay);
    lines.push(
      ``,
      `[ACTIVE SESSION] roadmapDay: ${roadmapDay}, phase: "${phase.name}", vectorTrack: ${vectorTrack}, themeHex: ${themeHex}`,
    );
  }

  return lines.join("\n");
};
