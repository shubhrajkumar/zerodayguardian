import { env } from "../../src/config/env.mjs";
import { runDockerSandboxCommand } from "./dockerSandboxService.mjs";

const NO_VERIFIED_DATA = "No verified data.";
const DEMO_MODE = "demo_learning";

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
    outputs: {
      help:
        "Allowed commands:\n- status\n- next\n- nmap -sn target.local\n- nmap -sV target.local\n- dig target.local\n- whois target.local\n- curl -I https://target.local\n- traceroute target.local\n- openssl s_client -connect target.local:443\n- nc -zv target.local 22\n- report summary\n- complete",
      status:
        "Lab status: ready.\nTargets: target.local (host), target-app (web), mail-sim (email artifacts).\nGoal: practice multi-tool recon and produce a short findings report.",
      next:
        "Next step: start with discovery. Try `nmap -sn target.local` to confirm reachability.",
      "nmap -sn target.local":
        "Starting Nmap scan against target.local\nHost is up (0.021s latency)\nMAC Address: 02:42:ac:11:00:02 (Sandbox)\nNmap done: 1 IP address (1 host up)",
      "nmap -sV target.local":
        "PORT   STATE SERVICE VERSION\n22/tcp open  ssh     OpenSSH 8.9\n80/tcp open  http    nginx 1.22\n443/tcp open https   nginx 1.22\n\nNotes:\n- SSH is exposed; confirm key-based auth only.\n- HTTP should redirect to HTTPS if public.",
      "dig target.local":
        ";; ANSWER SECTION:\ntarget.local. 300 IN A 10.0.12.45\n\nNotes:\n- Internal DNS record resolved.\n- Confirm scope authorization before deeper testing.",
      "whois target.local":
        "WHOIS lookup:\n- Domain: target.local\n- Status: internal/lab reserved\n- Registrant: Zero Day Guardian Lab\n\nNotes:\n- Treat as lab-only asset.\n- Document owner for reporting.",
      "curl -I https://target.local":
        "HTTP/2 200\nserver: nginx/1.22\ncontent-type: text/html; charset=utf-8\nstrict-transport-security: missing\nx-frame-options: missing\n\nRecommendation: add HSTS and clickjacking protection.",
      "traceroute target.local":
        "traceroute to target.local (10.0.12.45), 30 hops max\n 1  10.0.0.1  1.2 ms\n 2  10.0.12.45  3.6 ms\n\nNotes:\n- Direct internal path, minimal hops.",
      "openssl s_client -connect target.local:443":
        "CONNECTED(00000003)\nProtocol: TLSv1.2\nCipher: ECDHE-RSA-AES256-GCM-SHA384\nVerify return code: 0 (ok)\n\nNotes:\n- TLS is active.\n- Consider upgrading to TLSv1.3 if supported.",
      "nc -zv target.local 22":
        "Connection to target.local 22 port [tcp/ssh] succeeded!\n\nNotes:\n- SSH reachable.\n- Confirm MFA or key-only access.",
      "report summary":
        "Summary Report:\n- target.local reachable; SSH/HTTP/HTTPS exposed\n- DNS resolves to internal lab host\n- TLS active but missing HSTS + clickjacking headers\n- SSH reachable; confirm key-only access\nNext: harden headers, validate SSH auth policy, document ownership.",
      complete: "Practice objective complete. Save lab progress and move to challenge mode.",
    },
    feedback: {
      "nmap -sn target.local": {
        status: "surface-confirmed",
        riskLevel: "MEDIUM",
        confidence: 82,
        evidenceCount: 1,
        operatorAction: "Pivot into service validation and note that the host is reachable inside the training segment.",
        realtimeSignals: ["host-reachable"],
      },
      "nmap -sV target.local": {
        status: "services-exposed",
        riskLevel: "HIGH",
        confidence: 89,
        evidenceCount: 3,
        operatorAction: "Prioritize SSH and web hardening checks before reporting the surface as acceptable.",
        realtimeSignals: ["service-exposure", "ssh-open", "web-stack-visible"],
      },
      "curl -I https://target.local": {
        status: "hardening-gap-detected",
        riskLevel: "HIGH",
        confidence: 91,
        evidenceCount: 2,
        operatorAction: "Document missing HSTS and frame protections, then map them to a remediation checklist.",
        realtimeSignals: ["tls-posture", "header-misconfiguration"],
      },
      "report summary": {
        status: "operator-handoff-ready",
        riskLevel: "MEDIUM",
        confidence: 87,
        evidenceCount: 4,
        operatorAction: "Share the evidence-backed report and propose a validation window after hardening.",
        realtimeSignals: ["handoff-ready", "evidence-packaged"],
      },
      complete: {
        status: "mission-cleared",
        riskLevel: "LOW",
        confidence: 95,
        evidenceCount: 4,
        operatorAction: "Advance to a deeper scenario or rerun this one with fewer hints for mastery.",
        realtimeSignals: ["mission-cleared", "ready-for-next-stage"],
      },
    },
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
    practiceEnvironment: "No verified data.",
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
    outputs: {
      help: "Allowed commands:\n- status\n- next\n- analyze sample-1\n- analyze sample-2\n- extract urls sample-1\n- extract urls sample-2\n- report summary\n- complete",
      status:
        "Lab status: ready.\nSamples: sample-1 (high risk), sample-2 (low risk)\nGoal: classify risk and choose containment.",
      next:
        "Next step: inspect sender + urgency cues. Try `analyze sample-1` to start.",
      "analyze sample-1":
        "Sample 1:\n- Sender mismatch (from: support@paypa1.com)\n- Urgent language + invoice lure\n- Domain age: 3 days\nRisk score: HIGH\nAction: quarantine, block sender, notify users.",
      "analyze sample-2":
        "Sample 2:\n- Internal sender\n- DKIM aligned\n- Link points to known intranet host\nRisk score: LOW\nAction: mark safe after validation.",
      "extract urls sample-1":
        "Extracted URLs:\n- http://paypa1-secure-billing.com/login\n- http://img-cdn-paypa1.com/track.png\nRecommendation: block domains and add to URL denylist.",
      "extract urls sample-2":
        "Extracted URLs:\n- https://intranet.company.local/policy\nNo external redirect detected.",
      "report summary":
        "Summary:\n- 1 high-risk message\n- 1 low-risk message\nSuggested control: SPF/DKIM/DMARC enforcement + awareness drill.",
      complete: "Practice objective complete. Save lab progress and move to challenge mode.",
    },
    feedback: {
      "analyze sample-1": {
        status: "phish-confirmed",
        riskLevel: "HIGH",
        confidence: 93,
        evidenceCount: 3,
        operatorAction: "Quarantine the message, block the sending domain, and notify the impacted user group.",
        realtimeSignals: ["sender-mismatch", "domain-age", "urgent-language"],
      },
      "extract urls sample-1": {
        status: "infrastructure-mapped",
        riskLevel: "HIGH",
        confidence: 90,
        evidenceCount: 2,
        operatorAction: "Add both extracted domains to blocklists and search mail logs for the same URL pattern.",
        realtimeSignals: ["malicious-links", "tracking-infrastructure"],
      },
      "analyze sample-2": {
        status: "false-positive-contained",
        riskLevel: "LOW",
        confidence: 84,
        evidenceCount: 2,
        operatorAction: "Document why the message is low risk so analysts do not over-escalate similar mail.",
        realtimeSignals: ["mail-alignment", "trusted-destination"],
      },
      complete: {
        status: "mission-cleared",
        riskLevel: "LOW",
        confidence: 95,
        evidenceCount: 4,
        operatorAction: "Move into a harder social-engineering scenario or review containment timing.",
        realtimeSignals: ["mission-cleared", "triage-routine-built"],
      },
    },
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
    practiceEnvironment: "No verified data.",
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
    outputs: {
      help: "Allowed commands:\n- status\n- next\n- recon target-app\n- recon target-app --headers\n- test xss\n- test sqli\n- report findings\n- complete",
      status:
        "Lab status: ready.\nTarget: target-app\nGoal: find weak headers and validate common web risks.",
      next:
        "Next step: enumerate endpoints. Try `recon target-app` to list surface areas.",
      "recon target-app":
        "Discovered endpoints: /login /search /profile\nObserved: missing CSP header and permissive input reflection on /search.",
      "recon target-app --headers":
        "Headers:\n- Server: nginx/1.22\n- X-Frame-Options: missing\n- Content-Security-Policy: missing\nRecommendation: add CSP + clickjacking protection.",
      "test xss":
        "Reflected payload observed in /search response.\nRisk: MEDIUM\nFix: output encoding + CSP + input validation.",
      "test sqli":
        "No injection confirmed with baseline payloads.\nRecommendation: parameterized queries + prepared statements verification.",
      "report findings":
        "Report:\n- Reflected XSS candidate in /search\n- Missing CSP header\nNext step: create patch test cases and verify remediation.",
      complete: "Practice objective complete. Save lab progress and move to challenge mode.",
    },
    feedback: {
      "recon target-app": {
        status: "attack-surface-mapped",
        riskLevel: "MEDIUM",
        confidence: 85,
        evidenceCount: 2,
        operatorAction: "Prioritize header review and search endpoint reflection before moving to exploit simulation.",
        realtimeSignals: ["endpoint-enumeration", "input-reflection-clue"],
      },
      "recon target-app --headers": {
        status: "defensive-gap-confirmed",
        riskLevel: "HIGH",
        confidence: 92,
        evidenceCount: 2,
        operatorAction: "Flag CSP and clickjacking headers as missing and attach remediation guidance.",
        realtimeSignals: ["header-gap", "browser-hardening-missing"],
      },
      "test xss": {
        status: "exploit-path-demonstrated",
        riskLevel: "HIGH",
        confidence: 94,
        evidenceCount: 3,
        operatorAction: "Shift from proof-of-weakness to fix validation: encoding, CSP, and regression testing.",
        realtimeSignals: ["xss-reflection", "payload-rendered", "user-impact-possible"],
      },
      "test sqli": {
        status: "control-validated",
        riskLevel: "LOW",
        confidence: 80,
        evidenceCount: 1,
        operatorAction: "Keep documenting why injection was not confirmed and which controls still need verification.",
        realtimeSignals: ["sqli-resistance"],
      },
      complete: {
        status: "mission-cleared",
        riskLevel: "LOW",
        confidence: 95,
        evidenceCount: 4,
        operatorAction: "Advance to a chained attack simulation or re-run with fewer hints for stronger analyst muscle memory.",
        realtimeSignals: ["mission-cleared", "patch-validation-ready"],
      },
    },
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
    practiceEnvironment: "Simulated SOC environment: endpoint-sim, auth-sim, proxy-sim.",
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
    outputs: {
      help: "Allowed commands:\n- status\n- next\n- review alert-7\n- correlate identity\n- correlate proxy\n- contain host-24\n- report handoff\n- complete",
      status: "Mission status: active.\nSignals: alert-7 (endpoint), identity anomaly, proxy beaconing.\nGoal: correlate evidence and produce a clean handoff.",
      next: "Next step: inspect the highest-risk signal first. Try `review alert-7`.",
      "review alert-7": "Alert 7:\n- Unsigned binary launched from temp path\n- Parent process: winword.exe\n- Outbound connection observed after execution\nAssessment: suspicious initial execution chain.",
      "correlate identity": "Identity correlation:\n- Same user had 6 failed logins before successful sign-in\n- MFA push fatigue likely\nAssessment: account pressure observed around execution window.",
      "correlate proxy": "Proxy correlation:\n- Host beaconed to rare domain every 90 seconds\n- Small encrypted outbound payloads observed\nAssessment: behavior consistent with lightweight command-and-control.",
      "contain host-24": "Containment action:\n- Host 24 isolated in simulated EDR\n- User session flagged for reset\nAssessment: containment recommended while validation continues.",
      "report handoff": "Handoff Summary:\n- Likely phishing-led execution on host-24\n- Endpoint + identity + proxy evidence align on a malicious chain\n- Confidence: medium-high\n- Recommended actions: isolate host, reset credentials, review email source, hunt for same indicator set",
      complete: "Pro mission complete. Save progress, review the incident narrative, and request mentor feedback.",
    },
    feedback: {
      "review alert-7": {
        status: "initial-execution-chain",
        riskLevel: "HIGH",
        confidence: 88,
        evidenceCount: 2,
        operatorAction: "Treat the endpoint alert as the lead signal and immediately look for corroborating identity or network evidence.",
        realtimeSignals: ["endpoint-alert", "suspicious-parent-process"],
      },
      "correlate identity": {
        status: "identity-pressure-linked",
        riskLevel: "HIGH",
        confidence: 86,
        evidenceCount: 3,
        operatorAction: "Escalate confidence and prepare a credential reset path if the network evidence lines up.",
        realtimeSignals: ["identity-pressure", "mfa-fatigue"],
      },
      "correlate proxy": {
        status: "c2-pattern-confirmed",
        riskLevel: "HIGH",
        confidence: 93,
        evidenceCount: 4,
        operatorAction: "Move from triage to containment and scope hunt for peers hitting the same rare domain.",
        realtimeSignals: ["proxy-beaconing", "rare-domain", "encrypted-egress"],
      },
      "contain host-24": {
        status: "containment-executed",
        riskLevel: "MEDIUM",
        confidence: 90,
        evidenceCount: 4,
        operatorAction: "Document containment timing, isolate related identities, and preserve evidence for review.",
        realtimeSignals: ["containment", "host-isolated"],
      },
      "report handoff": {
        status: "operator-handoff-ready",
        riskLevel: "MEDIUM",
        confidence: 94,
        evidenceCount: 5,
        operatorAction: "Deliver the handoff with scope, confidence, and the next three response actions.",
        realtimeSignals: ["handoff-ready", "evidence-packaged"],
      },
      complete: {
        status: "mission-cleared",
        riskLevel: "LOW",
        confidence: 96,
        evidenceCount: 5,
        operatorAction: "Advance into chained missions or re-run for faster containment with fewer hints.",
        realtimeSignals: ["mission-cleared", "operator-ready"],
      },
    },
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
    practiceEnvironment: "Simulated auth portal: auth-sim.local with login, OTP, and session-recovery flows.",
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
    outputs: {
      help: "Allowed commands:\n- status\n- next\n- profile login-flow\n- test otp-reuse\n- test session-fixation\n- report auth-risk\n- complete",
      status: "Scenario status: active.\nSurface: login, OTP verification, session recovery.\nGoal: identify weak auth controls and recommend fixes.",
      next: "Next step: establish baseline control coverage. Try `profile login-flow`.",
      "profile login-flow": "Auth profile:\n- Lockout threshold not triggered after 6 attempts\n- OTP endpoint responds consistently without cooldown\n- Session token rotates only on full logout\nAssessment: multiple auth-control gaps likely.",
      "test otp-reuse": "OTP reuse simulation:\n- Same code accepted twice within 90 seconds\n- Replay window remains open after first success\nRisk: HIGH\nFix: one-time use enforcement + short replay cache + device binding.",
      "test session-fixation": "Session fixation simulation:\n- Session identifier persisted after privilege change\n- New login inherited the same session context\nRisk: HIGH\nFix: rotate session ID on auth and privilege transitions.",
      "report auth-risk": "Auth Risk Report:\n- Weak lockout posture\n- OTP replay window open\n- Session rotation missing on privilege change\nNext: enforce rate limits, bind OTPs, and rotate sessions on every auth step.",
      complete: "Authentication bypass drill complete. Review the attack path and compare it against your remediation checklist.",
    },
    feedback: {
      "profile login-flow": {
        status: "control-gap-mapped",
        riskLevel: "MEDIUM",
        confidence: 84,
        evidenceCount: 2,
        operatorAction: "Prioritize lockout and OTP replay validation before writing the final risk note.",
        realtimeSignals: ["rate-limit-gap", "account-recovery-risk"],
      },
      "test otp-reuse": {
        status: "otp-replay-confirmed",
        riskLevel: "HIGH",
        confidence: 92,
        evidenceCount: 3,
        operatorAction: "Escalate the auth risk and recommend one-time enforcement with replay invalidation.",
        realtimeSignals: ["otp-reuse", "replay-window-open"],
      },
      "test session-fixation": {
        status: "session-fixation-confirmed",
        riskLevel: "HIGH",
        confidence: 94,
        evidenceCount: 3,
        operatorAction: "Call out session rotation failure and map it to post-login token regeneration controls.",
        realtimeSignals: ["session-fixation", "token-rotation-missing"],
      },
      "report auth-risk": {
        status: "operator-handoff-ready",
        riskLevel: "HIGH",
        confidence: 95,
        evidenceCount: 4,
        operatorAction: "Send the auth hardening report and require retest after fixes land.",
        realtimeSignals: ["handoff-ready", "auth-hardening-needed"],
      },
      complete: {
        status: "mission-cleared",
        riskLevel: "LOW",
        confidence: 96,
        evidenceCount: 4,
        operatorAction: "Advance to a tougher scenario or rerun without hints to improve reasoning speed.",
        realtimeSignals: ["mission-cleared", "auth-path-mastered"],
      },
    },
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
    practiceEnvironment: "Simulated API tier: api-sim.local with gateway, debug endpoint, and token introspection.",
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
    outputs: {
      help: "Allowed commands:\n- status\n- next\n- inspect gateway\n- check debug endpoint\n- trace token scope\n- report api-risk\n- complete",
      status: "Scenario status: active.\nSurface: gateway, debug endpoint, token introspection.\nGoal: contain token exposure and reduce privilege risk.",
      next: "Next step: inspect the normal API path first. Try `inspect gateway`.",
      "inspect gateway": "Gateway review:\n- Authorization header forwarded to downstream debug service\n- Response body includes debug trace IDs and service role labels\nAssessment: noisy boundary with potential credential spillover.",
      "check debug endpoint": "Debug endpoint simulation:\n- Temporary support endpoint echoed a bearer token fragment in JSON output\n- Token fragment belonged to a service account with write scope\nRisk: HIGH\nFix: remove debug echo, rotate token, restrict endpoint access.",
      "trace token scope": "Scope review:\n- Leaked token mapped to service: deployment-bot\n- Scope included config:write and secrets:read\nRisk: HIGH\nFix: split scopes, reduce service role privileges, enforce short-lived tokens.",
      "report api-risk": "API Risk Report:\n- Debug path exposed credential fragments\n- Service token scope too broad\n- Gateway leaked internal role context\nNext: revoke token, trim scopes, remove debug echo, retest boundaries.",
      complete: "API token exposure mission complete. Lock in the containment sequence and compare scope reduction options.",
    },
    feedback: {
      "inspect gateway": {
        status: "boundary-noise-detected",
        riskLevel: "MEDIUM",
        confidence: 83,
        evidenceCount: 2,
        operatorAction: "Pivot into debug endpoint validation and check whether authorization data crosses trust boundaries.",
        realtimeSignals: ["debug-surface", "boundary-leak-clue"],
      },
      "check debug endpoint": {
        status: "token-leak-confirmed",
        riskLevel: "HIGH",
        confidence: 95,
        evidenceCount: 3,
        operatorAction: "Trigger token rotation and disable the debug path before continuing deep analysis.",
        realtimeSignals: ["token-leak", "support-endpoint-exposure"],
      },
      "trace token scope": {
        status: "privilege-overreach-confirmed",
        riskLevel: "HIGH",
        confidence: 94,
        evidenceCount: 4,
        operatorAction: "Document excessive scope and recommend least-privilege redesign with short-lived credentials.",
        realtimeSignals: ["scope-overreach", "revocation-needed"],
      },
      complete: {
        status: "mission-cleared",
        riskLevel: "LOW",
        confidence: 96,
        evidenceCount: 4,
        operatorAction: "Advance into a chained cloud/API scenario or rerun with tighter response timing.",
        realtimeSignals: ["mission-cleared", "token-risk-contained"],
      },
    },
    tips: [
      "Credential exposure is often a boundary problem, not just a secret-storage problem.",
      "Containment should start with revocation and scope reduction, not only root-cause notes.",
    ],
  },
};

const commandExplanations = {
  "nmap-basics": {
    help: "Shows the simulated-mission command set for this practice flow.",
    status: "Explains the current objective, targets, and success criteria.",
    next: "Recommends the next safe training step so beginners can keep momentum.",
    "nmap -sn target.local": "Simulated host discovery to show what reachability checks look like before deeper enumeration.",
    "nmap -sV target.local": "Simulated service fingerprinting to teach how operators interpret open ports and versions.",
    "dig target.local": "Simulated DNS lookup to connect recon with scope ownership and target validation.",
    "whois target.local": "Simulated WHOIS context to show ownership documentation in reports.",
    "curl -I https://target.local": "Simulated header check to teach fast HTTPS and missing-header review.",
    "traceroute target.local": "Simulated path visibility to explain how network routing context can support triage.",
    "openssl s_client -connect target.local:443": "Simulated TLS inspection to teach certificate and protocol review.",
    "nc -zv target.local 22": "Simulated port validation to reinforce the difference between discovered and reachable services.",
    "report summary": "Summarizes the simulated evidence into a short operator-style report.",
    complete: "Marks the practice sequence complete and prompts the learner toward challenge mode.",
  },
  "phishing-triage": {
    help: "Shows the simulated triage commands available for this email-analysis practice flow.",
    status: "Explains the current samples and what the learner should classify.",
    next: "Suggests the next training action for step-by-step phishing triage.",
    "analyze sample-1": "Simulated analysis of a high-risk phishing sample with visible red flags.",
    "analyze sample-2": "Simulated analysis of a lower-risk validated sample to teach comparison.",
    "extract urls sample-1": "Shows how suspicious URLs are extracted and interpreted safely in training.",
    "extract urls sample-2": "Shows a safer link extraction result for a benign-like comparison sample.",
    "report summary": "Builds a concise training summary with risk and recommended controls.",
    complete: "Closes the triage lesson and points the learner to the next challenge.",
  },
  "web-exploit-basics": {
    help: "Shows the simulated exploit-fundamentals commands available in this lab.",
    status: "Explains the objective and what defensive lessons the learner should take away.",
    next: "Recommends the next safe practice action in the simulated exploitation flow.",
    "recon target-app": "Simulated endpoint enumeration to teach attack-surface mapping without touching a live target.",
    "recon target-app --headers": "Simulated header review to show how missing protections are spotted.",
    "test xss": "Demonstrates a safe reflected-XSS finding and its mitigation logic.",
    "test sqli": "Demonstrates a safe SQLi validation path and why prepared statements matter.",
    "report findings": "Creates a defensive findings summary tied to the simulated evidence.",
    complete: "Marks the lesson complete and points to next practice steps.",
  },
  "incident-hunt-pro": {
    help: "Shows the pro-mission command set for this correlation and incident-handoff scenario.",
    status: "Explains the active signals and what evidence the learner should correlate.",
    next: "Recommends the next analyst step for a structured hunt workflow.",
    "review alert-7": "Introduces the primary endpoint signal and teaches triage-first reasoning.",
    "correlate identity": "Adds identity evidence to teach multi-source analyst correlation.",
    "correlate proxy": "Adds network evidence to teach corroboration and confidence building.",
    "contain host-24": "Demonstrates a safe containment decision inside a guided incident scenario.",
    "report handoff": "Builds a concise operator-style handoff summary from correlated evidence.",
    complete: "Marks the pro mission complete and prompts the learner to review reasoning quality.",
  },
  "auth-bypass-sim": {
    help: "Shows the safe command set for this simulated authentication bypass mission.",
    status: "Explains the auth surface and what control gaps you are validating.",
    next: "Recommends the next safe step for the login-flow assessment.",
    "profile login-flow": "Simulated profiling of the login and recovery surface to reveal control gaps.",
    "test otp-reuse": "Demonstrates a safe OTP replay weakness and how to reason about impact.",
    "test session-fixation": "Demonstrates a safe session fixation weakness and its remediation path.",
    "report auth-risk": "Summarizes the auth scenario into a concise operator-ready report.",
    complete: "Marks the auth mission complete and prepares the learner for the next scenario.",
  },
  "api-token-exposure": {
    help: "Shows the safe command set for this simulated API credential exposure mission.",
    status: "Explains the API surfaces under review and the expected validation outcome.",
    next: "Recommends the next safe step for the API token investigation.",
    "inspect gateway": "Simulated API gateway review to find boundary clues before deeper token analysis.",
    "check debug endpoint": "Demonstrates a safe credential leak through a verbose debug path.",
    "trace token scope": "Explains how to reason about privilege overreach after a token leak is found.",
    "report api-risk": "Builds a concise remediation-first API risk summary.",
    complete: "Marks the API mission complete and prepares the learner for a harder follow-up.",
  },
};

const deriveDefaultFeedback = (lab, normalizedCommand, objectiveIndex, scoring) => {
  const completed = normalizedCommand === "complete";
  const informational = ["help", "status", "next"].includes(normalizedCommand);
  const nextHint = normalizedCommand === "next"
    ? lab.stepHints?.[0] || null
    : lab.stepHints?.[Math.min(Math.max(objectiveIndex + 1, 0), Math.max(0, (lab.stepHints || []).length - 1))] || null;
  return {
    status: completed ? "mission-cleared" : informational ? "guidance-ready" : "investigating",
    riskLevel: completed ? "LOW" : informational ? "LOW" : "MEDIUM",
    confidence: completed ? 95 : informational ? 72 : 80,
    evidenceCount: informational ? 0 : Math.max(1, objectiveIndex + 1),
    operatorAction: completed
      ? "Close the scenario and move to the next mission or re-run it with fewer hints."
      : informational
        ? "Use the suggested next step to keep the mission moving."
        : "Capture this signal, compare it with the next objective, and prepare a short finding note.",
    realtimeSignals: informational ? ["guidance-ready"] : (lab.realtimeSignals || []).slice(0, Math.max(1, objectiveIndex + 1)),
    nextHint,
    urgency: completed ? "resolved" : informational ? "low" : "elevated",
    scoreDelta: completed ? scoring.completionBonus : scoring.commandPoints,
  };
};

const normalizeCommand = (value = "") => String(value || "").trim().replace(/\s+/g, " ");

const buildAllowedSet = (lab = null) => new Set((lab?.allowedCommands || []).map((command) => normalizeCommand(command)));

const buildLabView = ([id, lab]) => ({
  id,
  title: `${lab.title} (Simulated Mission)`,
  description: `${lab.description} This is a clearly labeled simulated training workflow for safe learning only.`,
  objective: lab.objective,
  practiceEnvironment: `Simulated training environment only. ${lab.practiceEnvironment}`,
  steps: lab.steps,
  recommendedTools: lab.recommendedTools,
  challengeModeHint: lab.challengeModeHint,
  allowedCommands: lab.allowedCommands,
  tips: [...lab.tips, "Simulated outputs are for learning only and must not be treated as verified scan evidence."],
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
  attackNarrative: lab.attackNarrative || "Safe simulated scenario for guided practice only.",
  realtimeSignals: lab.realtimeSignals || [],
  timerMinutes: Number(lab.timerMinutes || lab.estimatedMinutes || 12),
  supportedModes: lab.supportedModes || ["solo", "squad"],
  branchOutcomes: lab.branchOutcomes || [],
  mode: DEMO_MODE,
  verified: false,
  validationLayer: "allowlist_commands_only",
  separationNotice: "Use Dashboard or OSINT modules for verified DNS, MX, WHOIS, headers, and website scans.",
});

export const listLabs = () => Object.entries(labs).map(buildLabView);

export const runLabCommand = async ({ labId, command }) => {
  void env;
  void runDockerSandboxCommand;
  const normalizedLabId = String(labId || "").trim();
  const normalizedCommand = normalizeCommand(command);
  const lab = labs[normalizedLabId];

  if (!lab) {
    return {
      ok: false,
      code: "unknown_lab",
      output: "Simulated mission not found. Pick a listed training mission before running commands.",
      mentorHint: "Select a valid lab from the learning module list first.",
      fixSteps: [
        "Choose one of the visible simulated missions.",
        "Use only the listed training commands for that mission.",
        "Keep real OSINT and live scans in the dashboard modules.",
      ],
      tips: ["Training mode validates both mission and command names before execution."],
      mode: DEMO_MODE,
      verified: false,
    };
  }

  const allowedSet = buildAllowedSet(lab);
  if (!normalizedCommand) {
    return {
      ok: false,
      code: "missing_command",
      output: "Enter one training command before running the mission.",
      mentorHint: "Start with `help` to see the guided training command list.",
      fixSteps: [
        "Run `help` to inspect allowed commands.",
        "Choose one command from the list.",
        "Follow the suggested next step after each result.",
      ],
      tips: ["Simulated missions are command-allowlisted for stable beginner-friendly output."],
      mode: DEMO_MODE,
      verified: false,
    };
  }

  if (!allowedSet.has(normalizedCommand)) {
    return {
      ok: false,
      code: "command_not_allowed",
      output: `Command not allowed in training mode: ${normalizedCommand}`,
      mentorHint: "Use the listed training commands only. Real offensive actions remain separated from verified product modules.",
      fixSteps: [
        "Run `help` to see the approved training commands.",
        "Use `next` if you want the recommended follow-up step.",
        "Switch to Dashboard modules for verified live scanning workflows.",
      ],
      tips: ["Training commands are intentionally constrained so outputs stay stable and easy to learn from."],
      mode: DEMO_MODE,
      verified: false,
    };
  }

  const output = String(lab.outputs?.[normalizedCommand] || NO_VERIFIED_DATA).trim();
  const explanation = commandExplanations?.[normalizedLabId]?.[normalizedCommand] || "Simulated output for guided learning.";
  const scoring = lab.scoring || { maxPoints: 100, commandPoints: 10, completionBonus: 20, badges: [] };
  const objectiveIndex = Math.min(
    (lab.allowedCommands || []).filter((item) => !["help", "status", "next"].includes(item)).indexOf(normalizedCommand),
    Math.max(0, (lab.objectives || []).length - 1)
  );
  const clearedObjective = objectiveIndex >= 0 ? lab.objectives?.[objectiveIndex] || null : null;
  const scoreDelta = normalizedCommand === "complete" ? scoring.completionBonus : scoring.commandPoints;
  const commandFeedback = {
    ...deriveDefaultFeedback(lab, normalizedCommand, objectiveIndex, scoring),
    ...(lab.feedback?.[normalizedCommand] || {}),
  };
  const branchOutcomes = Array.isArray(lab.branchOutcomes) ? lab.branchOutcomes : [];
  const branchOutcome =
    normalizedCommand === "complete"
      ? branchOutcomes[1] || branchOutcomes[0] || null
      : String(commandFeedback.riskLevel || "").toUpperCase() === "HIGH"
        ? branchOutcomes[0] || null
        : branchOutcomes[1] || branchOutcomes[0] || null;
  return {
    ok: true,
    code: normalizedCommand === "complete" ? "completed" : "demo_ok",
    output: `[SIMULATED MISSION OUTPUT]\n${output}`,
    explanation,
    mentorHint: explanation,
    tips: [
      `Explanation: ${explanation}`,
      "Simulated result only. Do not treat this as verified scan evidence.",
      "Use Dashboard or OSINT modules when you need real verified data.",
    ],
    evaluation: {
      scoreDelta,
      maxPoints: scoring.maxPoints,
      clearedObjective,
      badgeCandidate: normalizedCommand === "complete" ? scoring.badges?.[0] || null : null,
      nextHint: commandFeedback.nextHint,
    },
    feedback: {
      status: commandFeedback.status,
      riskLevel: commandFeedback.riskLevel,
      confidence: commandFeedback.confidence,
      evidenceCount: commandFeedback.evidenceCount,
      operatorAction: commandFeedback.operatorAction,
      realtimeSignals: commandFeedback.realtimeSignals,
      urgency: commandFeedback.urgency,
      scenarioType: lab.scenarioType,
      vulnerabilityClass: lab.vulnerabilityClass,
      operatorRole: lab.operatorRole,
      branchOutcome,
    },
    mode: DEMO_MODE,
    verified: false,
    separationNotice: "Labs use simulated training output only. Real scans stay in Dashboard and OSINT workflows.",
  };
};
