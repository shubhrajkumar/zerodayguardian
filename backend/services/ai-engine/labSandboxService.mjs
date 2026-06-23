import { runDockerSandboxCommand } from "./dockerSandboxService.mjs";

const labs = {
  "nmap-basics": {
    level: "beginner",
    track: "defensive-recon",
    scenarioType: "exposed-attack-surface",
    vulnerabilityClass: "missing-hardening-controls",
    operatorRole: "surface-validation-analyst",
    attackNarrative: "A newly exposed internal host needs rapid validation before it is promoted into a broader environment.",
    estimatedMinutes: 12,
    title: "All Tools Practice Hub",
    description: "Practice the core security toolkit in one safe, guided sandbox flow.",
    objective: "Run a multi-tool recon sequence, capture evidence, and produce a concise findings summary.",
    practiceEnvironment: "Isolated training targets: target.local (host), target-app (web), mail-sim (email artifacts).",
    steps: [
      "Start with host discovery and basic service fingerprinting.",
      "Validate DNS + WHOIS context to understand scope ownership.",
      "Check HTTPS posture with headers and TLS handshake checks.",
      "Summarize risks, evidence, and next steps in one report.",
    ],
    recommendedTools: ["Nmap", "curl", "dig", "whois", "traceroute", "OpenSSL", "netcat"],
    challengeModeHint: "Combine two tools to validate one finding and propose a concrete remediation.",
    objectives: [
      "Confirm target reachability safely",
      "Identify exposed services and versions",
      "Inspect one DNS or ownership signal",
      "Summarize one risk and one fix",
    ],
    stepHints: [
      "Start with host discovery before service enumeration.",
      "Use DNS and WHOIS context to explain ownership and scope.",
      "Tie each open service to one defensive follow-up action.",
    ],
    scoring: {
      maxPoints: 140,
      commandPoints: 18,
      completionBonus: 32,
      badges: ["Recon Starter", "Surface Mapper"],
    },
    mentorFocus: "Guide the learner through recon order, evidence capture, and basic remediation framing.",
    realtimeSignals: ["host-reachable", "service-exposure", "tls-posture", "dns-ownership"],
    timerMinutes: 12,
    supportedModes: ["solo", "squad"],
    branchOutcomes: [
      { id: "surface-watch", title: "Surface Watch", condition: "Collect reachability and service evidence quickly.", reward: "Unlock a harder hardening review." },
      { id: "hardening-lead", title: "Hardening Lead", condition: "Prioritize header and SSH fixes in the report.", reward: "Earn a defensive remediation edge." },
    ],
    allowedCommands: [
      "help",
      "status",
      "next",
      "nmap -sn target.local",
      "nmap -sV target.local",
      "dig target.local",
      "whois target.local",
      "curl -I https://target.local",
      "traceroute target.local",
      "openssl s_client -connect target.local:443",
      "nc -zv target.local 22",
      "report summary",
      "complete",
    ],
    tips: [
      "Start with discovery, then validate DNS/WHOIS context, then confirm TLS posture.",
      "Never scan assets without authorization.",
    ],
  },
  "phishing-triage": {
    level: "intermediate",
    track: "defensive-email",
    scenarioType: "credential-harvest-email",
    vulnerabilityClass: "brand-impersonation-and-user-manipulation",
    operatorRole: "email-threat-analyst",
    attackNarrative: "A suspicious billing message landed in the finance queue and needs fast triage before a user clicks through.",
    estimatedMinutes: 14,
    title: "Phishing Triage Sandbox",
    description: "Analyze suspicious email indicators in a realistic but safe lab model.",
    objective: "Classify suspicious email samples and apply containment actions based on risk.",
    practiceEnvironment: "Docker sandbox with email sample analysis tools.",
    steps: [
      "Inspect sender identity and domain alignment.",
      "Review language urgency and social engineering cues.",
      "Assess link and attachment risk.",
      "Write a triage summary with response action.",
    ],
    recommendedTools: ["MXToolbox", "VirusTotal", "DMARC Analyzer"],
    challengeModeHint: "Detect one hidden phishing pattern and add one prevention control.",
    objectives: [
      "Classify sender and domain risk",
      "Inspect suspicious links safely",
      "Choose a containment action",
      "Write a short triage recommendation",
    ],
    stepHints: [
      "Check sender mismatch before link analysis.",
      "Use urgency language as a clue, not proof by itself.",
      "Finish with one containment action and one preventive control.",
    ],
    scoring: {
      maxPoints: 160,
      commandPoints: 20,
      completionBonus: 40,
      badges: ["Phish Triage", "Inbox Defender"],
    },
    mentorFocus: "Coach the learner through phishing triage logic, false-positive control, and safe reporting language.",
    realtimeSignals: ["sender-mismatch", "domain-age", "malicious-links", "mail-alignment"],
    timerMinutes: 14,
    supportedModes: ["solo", "squad"],
    branchOutcomes: [
      { id: "rapid-containment", title: "Rapid Containment", condition: "Quarantine the high-risk sample before comparing the low-risk one.", reward: "Boost response confidence." },
      { id: "false-positive-guard", title: "False Positive Guard", condition: "Explain clearly why sample-2 should not be escalated.", reward: "Improve analyst trust." },
    ],
    allowedCommands: ["help", "status", "next", "analyze sample-1", "analyze sample-2", "extract urls sample-1", "extract urls sample-2", "report summary", "complete"],
    tips: [
      "Check sender alignment before opening links.",
      "Pair user awareness with technical controls for best outcomes.",
    ],
  },
  "web-exploit-basics": {
    level: "advanced",
    track: "offensive-simulated",
    scenarioType: "web-input-abuse",
    vulnerabilityClass: "reflected-xss-and-header-hardening-gaps",
    operatorRole: "appsec-validation-operator",
    attackNarrative: "A staging web app is showing weak response controls and needs safe validation before remediation.",
    estimatedMinutes: 16,
    title: "Web Exploitation Fundamentals",
    description: "Practice ethical web exploitation flow with recon, validation, and remediation.",
    objective: "Detect common web weaknesses and map each finding to a defensive fix.",
    practiceEnvironment: "Docker sandbox with web application testing targets.",
    steps: [
      "Enumerate endpoints and attack surface.",
      "Test for reflected XSS in search flow.",
      "Validate SQLi resistance with baseline checks.",
      "Produce remediation checklist with verification steps.",
    ],
    recommendedTools: ["Burp Suite Community", "OWASP ZAP", "SQLMap"],
    challengeModeHint: "Demonstrate one exploit chain and one detection rule.",
    objectives: [
      "Map endpoint exposure in a safe simulated target",
      "Explain one reflected XSS weakness",
      "Validate one SQLi defensive control",
      "Produce remediation and verification notes",
    ],
    stepHints: [
      "Start with recon and headers before testing payload behavior.",
      "Explain why a finding matters before suggesting a fix.",
      "Always pair exploit understanding with a concrete defensive control.",
    ],
    scoring: {
      maxPoints: 180,
      commandPoints: 24,
      completionBonus: 48,
      badges: ["Exploit Analyst", "Patch Validator"],
    },
    mentorFocus: "Help the learner translate offensive discovery into remediation and verification steps.",
    realtimeSignals: ["endpoint-enumeration", "header-gap", "xss-reflection", "sqli-resistance"],
    timerMinutes: 16,
    supportedModes: ["solo", "squad"],
    branchOutcomes: [
      { id: "exploit-proof", title: "Exploit Proof", condition: "Demonstrate the XSS path before writing the report.", reward: "Unlock a deeper validation path." },
      { id: "patch-guardian", title: "Patch Guardian", condition: "Lead with remediation and verification controls.", reward: "Earn patch validation credit." },
    ],
    allowedCommands: ["help", "status", "next", "recon target-app", "recon target-app --headers", "test xss", "test sqli", "report findings", "complete"],
    tips: [
      "Exploit only in authorized environments.",
      "Always pair every finding with clear remediation guidance.",
    ],
  },
  "incident-hunt-pro": {
    level: "pro",
    track: "defensive-detection",
    scenarioType: "multi-signal-incident-response",
    vulnerabilityClass: "phishing-led-compromise-chain",
    operatorRole: "incident-response-lead",
    attackNarrative: "A fast-moving compromise may span endpoint execution, identity pressure, and low-noise beaconing across the environment.",
    estimatedMinutes: 20,
    title: "Incident Hunt Mission",
    description: "Run a pro-level guided mission that correlates endpoint, network, and identity clues in a safe simulated hunt.",
    objective: "Correlate multiple indicators, prioritize risk, and produce an operator-grade incident summary.",
    practiceEnvironment: "Docker sandbox SOC environment: endpoint-sim, auth-sim, proxy-sim.",
    steps: [
      "Review the alert context and identify the highest-risk signal.",
      "Correlate the endpoint clue with identity or network evidence.",
      "Decide on containment and articulate the confidence level.",
      "Summarize impact, evidence, and next actions like an analyst handoff.",
    ],
    recommendedTools: ["EDR Timeline", "Proxy Logs", "Identity Audit", "Sigma", "YARA"],
    challengeModeHint: "Build a short incident narrative with confidence, scope, and one containment decision.",
    objectives: [
      "Spot the primary signal",
      "Correlate at least two evidence sources",
      "Choose a containment action",
      "Produce an analyst handoff summary",
    ],
    stepHints: [
      "Start with the strongest alert, not the noisiest one.",
      "Correlation matters more than raw volume of indicators.",
      "State confidence clearly when evidence is incomplete.",
    ],
    scoring: {
      maxPoints: 220,
      commandPoints: 28,
      completionBonus: 56,
      badges: ["Threat Hunter", "Incident Narrator", "Pro Mission Cleared"],
    },
    mentorFocus: "Coach correlation, prioritization, analyst reasoning, and concise operator handoff language.",
    realtimeSignals: ["endpoint-alert", "identity-pressure", "proxy-beaconing", "containment"],
    timerMinutes: 20,
    supportedModes: ["solo", "squad"],
    branchOutcomes: [
      { id: "rapid-containment", title: "Rapid Containment", condition: "Contain the host immediately after strong correlation.", reward: "Increase response speed score." },
      { id: "evidence-first", title: "Evidence First", condition: "Build the handoff before containment for maximum clarity.", reward: "Increase analyst narrative score." },
    ],
    allowedCommands: ["help", "status", "next", "review alert-7", "correlate identity", "correlate proxy", "contain host-24", "report handoff", "complete"],
    tips: [
      "Correlate evidence before escalating severity.",
      "Contain decisively, but state confidence honestly.",
    ],
  },
  "auth-bypass-sim": {
    level: "intermediate",
    track: "offensive-simulated",
    scenarioType: "authentication-bypass",
    vulnerabilityClass: "weak-session-and-rate-limit-controls",
    operatorRole: "auth-flow-tester",
    attackNarrative: "A portal login flow is suspected of weak lockout and token validation controls during a release validation exercise.",
    estimatedMinutes: 15,
    title: "Authentication Bypass Drill",
    description: "Validate a simulated login flow for weak rate limiting, session handling, and recovery controls.",
    objective: "Test a vulnerable auth scenario safely, capture the bypass path, and recommend defensive controls.",
    practiceEnvironment: "Docker sandbox with auth portal: auth-sim.local with login, OTP, and session-recovery flows.",
    steps: [
      "Profile the login surface and understand the rate-limit posture.",
      "Check how OTP and session recovery behave under repeated attempts.",
      "Capture the weakness and explain realistic abuse impact.",
      "Write a remediation-first operator summary.",
    ],
    recommendedTools: ["Burp Repeater", "Auth Flow Mapper", "Session Viewer"],
    challengeModeHint: "Show one bypass path and one concrete control stack that blocks it.",
    objectives: [
      "Map the weak login control",
      "Validate one unsafe recovery behavior",
      "Explain the abuse path clearly",
      "Produce a remediation summary",
    ],
    stepHints: [
      "Start with rate limits and lockout behavior before touching token logic.",
      "Treat recovery flows as part of the attack surface, not an afterthought.",
      "Translate every weakness into a concrete control recommendation.",
    ],
    scoring: {
      maxPoints: 170,
      commandPoints: 22,
      completionBonus: 40,
      badges: ["Auth Breaker", "Recovery Defender"],
    },
    mentorFocus: "Guide the learner through authentication attack surface mapping and recovery hardening.",
    realtimeSignals: ["rate-limit-gap", "otp-reuse", "session-fixation", "account-recovery-risk"],
    timerMinutes: 15,
    supportedModes: ["solo", "squad"],
    branchOutcomes: [
      { id: "replay-hunter", title: "Replay Hunter", condition: "Validate OTP reuse before session issues.", reward: "Increase auth abuse confidence." },
      { id: "session-guardian", title: "Session Guardian", condition: "Catch fixation and recommend token rotation early.", reward: "Boost recovery hardening score." },
    ],
    allowedCommands: ["help", "status", "next", "profile login-flow", "test otp-reuse", "test session-fixation", "report auth-risk", "complete"],
    tips: [
      "Authentication flows fail in recovery paths as often as in login forms.",
      "Rate limiting, OTP binding, and token rotation should be evaluated together.",
    ],
  },
  "api-token-exposure": {
    level: "advanced",
    track: "defensive-api",
    scenarioType: "api-credential-exposure",
    vulnerabilityClass: "token-overexposure-and-weak-api-boundaries",
    operatorRole: "api-security-analyst",
    attackNarrative: "An internal API release may be leaking over-privileged tokens and overly verbose responses in staging.",
    estimatedMinutes: 17,
    title: "API Token Exposure Mission",
    description: "Investigate a simulated API for credential leakage, excessive privilege, and boundary validation mistakes.",
    objective: "Trace an exposed token path safely and recommend a minimum viable containment and hardening plan.",
    practiceEnvironment: "Docker sandbox API tier: api-sim.local with gateway, debug endpoint, and token introspection.",
    steps: [
      "Inspect the API surface and debug exposure points.",
      "Validate whether tokens leak in headers or response bodies.",
      "Assess privilege scope and replay potential.",
      "Deliver a containment and remediation summary.",
    ],
    recommendedTools: ["curl", "JWT Inspector", "Gateway Logs", "Schema Diff"],
    challengeModeHint: "Prove one leak path and one privilege-boundary fix that closes it.",
    objectives: [
      "Identify the leak source",
      "Confirm privilege misuse risk",
      "Choose a containment action",
      "Produce a clean response plan",
    ],
    stepHints: [
      "Start with the debug surface; leaked credentials often hide behind convenience endpoints.",
      "Scope matters: token leakage gets worse when privilege boundaries are broad.",
      "Finish with rotation, revocation, and response minimization guidance.",
    ],
    scoring: {
      maxPoints: 190,
      commandPoints: 24,
      completionBonus: 44,
      badges: ["API Watcher", "Token Guardian"],
    },
    mentorFocus: "Guide the learner through token-leak validation, privilege reasoning, and fast containment logic.",
    realtimeSignals: ["debug-surface", "token-leak", "scope-overreach", "revocation-needed"],
    timerMinutes: 17,
    supportedModes: ["solo", "squad"],
    branchOutcomes: [
      { id: "revocation-now", title: "Revocation Now", condition: "Rotate and revoke before broad scope analysis.", reward: "Boost containment score." },
      { id: "least-privilege", title: "Least Privilege", condition: "Lead with scope reduction after leak confirmation.", reward: "Boost architecture score." },
    ],
    allowedCommands: ["help", "status", "next", "inspect gateway", "check debug endpoint", "trace token scope", "report api-risk", "complete"],
    tips: [
      "Credential exposure is often a boundary problem, not just a secret-storage problem.",
      "Containment should start with revocation and scope reduction, not only root-cause notes.",
    ],
  },
};

const normalizeCommand = (value = "") => String(value || "").trim().replace(/\s+/g, " ");

const buildAllowedSet = (lab = null) => new Set((lab?.allowedCommands || []).map((command) => normalizeCommand(command)));

const buildLabView = ([id, lab]) => ({
  id,
  title: lab.title,
  description: `${lab.description} Execution happens in an isolated Docker sandbox with allowlisted targets and tools.`,
  objective: lab.objective,
  practiceEnvironment: lab.practiceEnvironment,
  steps: lab.steps,
  recommendedTools: lab.recommendedTools,
  challengeModeHint: lab.challengeModeHint,
  allowedCommands: lab.allowedCommands,
  tips: lab.tips,
  level: lab.level || "intermediate",
  track: lab.track || "general",
  estimatedMinutes: Number(lab.estimatedMinutes || 12),
  objectives: lab.objectives || [],
  stepHints: lab.stepHints || [],
  scoring: lab.scoring || { maxPoints: 100, commandPoints: 10, completionBonus: 20, badges: [] },
  mentorFocus: lab.mentorFocus || "Guide the learner through this mission clearly and safely.",
  scenarioType: lab.scenarioType || "guided-simulator",
  vulnerabilityClass: lab.vulnerabilityClass || "training-only",
  operatorRole: lab.operatorRole || "security-learner",
  attackNarrative: lab.attackNarrative || "Safe scenario for guided practice only.",
  realtimeSignals: lab.realtimeSignals || [],
  timerMinutes: Number(lab.timerMinutes || lab.estimatedMinutes || 12),
  supportedModes: lab.supportedModes || ["solo", "squad"],
  branchOutcomes: lab.branchOutcomes || [],
  mode: "sandbox",
  verified: true,
  validationLayer: "docker_allowlist",
  separationNotice: "Commands are executed in an isolated Docker sandbox with target and binary allowlisting.",
});

export const listLabs = () => Object.entries(labs).map(buildLabView);

export const runLabCommand = async ({ labId, command }) => {
  const normalizedLabId = String(labId || "").trim();
  const normalizedCommand = normalizeCommand(command);
  const lab = labs[normalizedLabId];

  if (!lab) {
    return {
      ok: false,
      code: "unknown_lab",
      output: "Lab not found. Pick a listed lab before running commands.",
      mentorHint: "Select a valid lab from the learning module list first.",
    };
  }

  const allowedSet = buildAllowedSet(lab);
  if (!normalizedCommand) {
    return {
      ok: false,
      code: "missing_command",
      output: "Enter a command before running the lab.",
      mentorHint: "Start with `help` to see the available command list.",
    };
  }

  if (!allowedSet.has(normalizedCommand)) {
    return {
      ok: false,
      code: "command_not_allowed",
      output: `Command not allowed: ${normalizedCommand}. Use 'help' to see available commands.`,
      mentorHint: "Use the listed commands only. The allowed set is constrained by the Docker sandbox binary allowlist.",
    };
  }

  // For informational commands, provide built-in guidance
  if (normalizedCommand === "help") {
    return {
      ok: true,
      code: "ok",
      output: `Allowed commands:\n${lab.allowedCommands.map((c) => `- ${c}`).join("\n")}\n\nTo execute a command, Docker sandbox will run it against the allowlisted targets.`,
    };
  }
  if (normalizedCommand === "status") {
    return {
      ok: true,
      code: "ok",
      output: `Lab: ${lab.title}\nTarget: ${lab.practiceEnvironment}\nGoal: ${lab.objective}`,
    };
  }
  if (normalizedCommand === "next") {
    const nextHint = lab.stepHints?.[0] || "Try one of the allowed commands listed in `help`.";
    return {
      ok: true,
      code: "ok",
      output: `Next step: ${nextHint}`,
    };
  }
  if (normalizedCommand === "complete") {
    return {
      ok: true,
      code: "completed",
      output: "Lab complete. You can continue practicing or switch to another lab.",
      evaluation: {
        scoreDelta: lab.scoring?.completionBonus || 20,
        maxPoints: lab.scoring?.maxPoints || 100,
      },
    };
  }

  // Execute the command in Docker sandbox
  try {
    const dockerResult = await runDockerSandboxCommand(normalizedCommand);
    return {
      ok: dockerResult.ok,
      code: dockerResult.ok ? "ok" : "execution_error",
      output: dockerResult.output || "Command completed with no output.",
      ...(dockerResult.ok
        ? {
            evaluation: {
              scoreDelta: lab.scoring?.commandPoints || 10,
              maxPoints: lab.scoring?.maxPoints || 100,
            },
          }
        : {
            mentorHint: "The command failed in the Docker sandbox. Check if the target is reachable and the binary is allowlisted.",
          }),
    };
  } catch (error) {
    return {
      ok: false,
      code: "sandbox_error",
      output: `Sandbox execution error: ${String(error?.message || error)}`,
      mentorHint: "Docker sandbox encountered an error. Make sure Docker is running and configured correctly.",
    };
  }
};
