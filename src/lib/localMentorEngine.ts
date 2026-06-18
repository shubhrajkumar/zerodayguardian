/**
 * localMentorEngine — Client-side fallback AI mentor that generates
 * context-aware cybersecurity responses when the live AI endpoint is
 * disconnected. Provides realistic, educational responses across
 * common cyber security topics so the UI never goes blank.
 */

type MentorContext = {
  topic?: string;
  skillLevel?: "beginner" | "intermediate" | "advanced";
  missionTitle?: string;
  missionPhase?: string;
  userMessage: string;
};

type MentorResponse = {
  text: string;
  suggestions: string[];
  type: "analysis" | "guidance" | "explanation" | "debrief";
};

// ── Response Templates ──

const ANALYSIS_TEMPLATES = [
  (ctx: MentorContext) => `I've analyzed your query against the current operational context.

**Key Observations:**
- Your question touches on ${ctx.topic || "cyber security fundamentals"}
- This is relevant to your current ${ctx.missionPhase || "learning"} phase
- Understanding this concept strengthens your ${ctx.skillLevel === "beginner" ? "foundational knowledge" : ctx.skillLevel === "intermediate" ? "practical skills" : "advanced expertise"}

**Technical Assessment:**
The core principle here involves understanding how systems interact at the protocol and application layer. When ${ctx.topic?.toLowerCase() || "a security control"} is properly implemented, it creates a defense-in-depth posture that raises the attacker's cost.

**Operational Recommendation:**
Practice this concept in a sandbox environment before applying it to production systems. Start with controlled scenarios to build muscle memory.`,
  (ctx: MentorContext) => `Running analysis on "${ctx.userMessage.slice(0, 60)}..." 

**Threat Modeling Perspective:**
From a threat modeling standpoint, you're asking about an area that intersects multiple attack surfaces. The primary risk vectors to consider are:

1️⃣ **Input validation** — Always assume untrusted data
2️⃣ **Authentication boundaries** — Where trust transitions between components
3️⃣ **Data at rest vs. in transit** — Different protection models apply

**MITRE ATT&CK Mapping:**
This maps to several TTPs depending on the specific implementation. The most relevant techniques involve ${ctx.skillLevel === "beginner" ? "initial access and discovery" : ctx.skillLevel === "intermediate" ? "credential access and privilege escalation" : "defense evasion and exfiltration"}.

**Practice Suggestion:**
Set up a small lab environment and walk through the attack chain step by step. Document each finding as if writing a penetration testing report.`,
];

const GUIDANCE_TEMPLATES = [
  (ctx: MentorContext) => `**Step-by-Step Guidance**

Here's how I'd approach this as a senior analyst mentoring a new operator:

**Step 1: Understand the Objective**
${ctx.missionTitle ? `Your current mission "${ctx.missionTitle}" requires you to` : "Your objective is to"} systematically identify the key components involved.

**Step 2: Gather Intelligence**
Start with passive recon — understand what information is publicly available before running any active scans. This reduces noise and helps you focus.

**Step 3: Develop a Hypothesis**
Based on what you've gathered, form a hypothesis about the system's behavior. What should happen under normal conditions?

**Step 4: Validate Safely**
Run controlled experiments in isolation. Change one variable at a time and observe the results.

**Step 5: Document Everything**
Every analyst's most valuable asset is their notes. Record commands, outputs, and your reasoning at each step.

**Mentor Tip:** The difference between a good operator and a great one is patience. Rushing through steps causes missed findings.`,
  (ctx: MentorContext) => `**Tactical Breakdown**

Let me break this down into actionable steps:

📋 **Preparation Phase:**
- Verify you have the right tooling for the task
- Set up logging/output capture before starting
- Define clear success criteria

🎯 **Execution Phase:**
- Start broad, then narrow down
- Use the simplest tool that achieves the objective
- Cross-validate findings with a second method

📊 **Analysis Phase:**
- Look for patterns rather than individual data points
- Correlate findings across multiple sources
- Identify false positives before acting on results

✅ **Verification Phase:**
- Repeat the key finding to confirm it's consistent
- Have a peer (or the ZORVIX mentor) review your approach
- Document remediation steps if this was an assessment

**Remember:** In operational security, consistency and methodology matter more than individual flashes of insight.`,
];

const EXPLANATION_TEMPLATES = [
  (ctx: MentorContext) => `**Core Concept Explained**

The concept you're asking about is fundamental to understanding modern security operations.

**What It Is:**
At its essence, this is about controlling the flow of information and access between different trust boundaries. Every system has implicit and explicit trust assumptions that can be abused.

**Why It Matters:**
- ${
  ctx.skillLevel === "beginner"
    ? "Understanding this gives you the foundation to analyze any security problem systematically."
    : ctx.skillLevel === "intermediate"
      ? "This is where most real-world vulnerabilities manifest — implementation gaps between the design and the code."
      : "Advanced exploitation of this concept is what separates script kiddies from professional penetration testers."
}

**Common Misconception:**
Many beginners think this is a binary state (secure/insecure), but in reality it's a spectrum. The question is always "secure against what threat model and at what cost?"

**Real-World Example:**
Consider a typical web application. The browser trusts the server, the server trusts the database, the database trusts the storage layer. Break any link in that trust chain and you have a security incident waiting to happen.

**How to Practice:**
Try the related missions in the ZeroDay Guardian roadmap. Each one builds on the previous, creating a complete mental model.`,
  (ctx: MentorContext) => `**Deep Dive: ${ctx.topic || "Cyber Security Fundamentals"}**

Let's explore this concept in depth.

**The Core Problem:**
Systems are designed for functionality first, security second. This creates inherent tension between "it works" and "it's secure."

**The Defense Strategy:**
Security professionals approach this with layered controls:

🔒 **Preventive Controls** — Stop the action before it happens
  • Access control lists, input validation, encryption
👁️ **Detective Controls** — Identify when something bad is happening
  • Monitoring, logging, intrusion detection systems
🔄 **Corrective Controls** — Fix the issue after detection
  • Patching, incident response procedures, backups

**Analyst's Perspective:**
The most effective security programs balance all three. Too much focus on prevention leads to alert fatigue when preventions fail. Too much on detection means you're always reacting.

**Key Takeaway:**
Security is not a product — it's a process of continuous improvement. Each engagement, each lab, each mission makes you a more effective operator.`,
];

const DEBRIEF_TEMPLATES = [
  (ctx: MentorContext) => `**Mission Debrief**

Based on your current progress, here's my assessment:

✅ **Strengths Identified:**
- You're asking the right questions about ${ctx.topic || "security fundamentals"}
- Your approach shows analytical thinking and curiosity — essential operator traits

📈 **Growth Areas:**
- ${ctx.skillLevel === "beginner" ? "Focus on hands-on practice alongside theory" : ctx.skillLevel === "intermediate" ? "Work on chaining multiple techniques together in a single flow" : "Focus on consistency and documentation quality"}
- Try to explain each concept in simple terms — if you can't teach it, you haven't mastered it

🎯 **Next Mission Suggestion:**
${ctx.missionTitle ? `Continue with ${ctx.missionTitle} and focus on the validation phase` : "Start with Recon Initiation to build your foundation"}

**Operator's Mindset:**
Stay curious. Stay methodical. The best analysts I've worked with are the ones who never stop asking "why?" — even when they already know the answer.

ZORVIX is here 24/7. Keep pushing forward.`,
  (ctx: MentorContext) => `**Progress Debrief — Current Status**

Let me assess where you are and what comes next:

📊 **Current Assessment:**
You're engaging with ${ctx.missionTitle || "cyber security concepts"} at a ${ctx.skillLevel || "beginner"} level. The questions you're asking show you're thinking about the right things — now it's about depth and repetition.

🔍 **What I'd Focus On:**
1. **Depth over breadth** — Master one technique before moving to the next
2. **Document your process** — Writing clarifies thinking
3. **Teach someone else** — The best way to solidify knowledge

⏱️ **Recommended Practice:**
Spend at least 30 minutes in the lab environment. Set a specific objective before starting (e.g., "I will find 3 open ports and identify their services").

💪 **Keep Going:**
Every expert was once a beginner. The 60-mission roadmap is designed to take you from Recruit to Elite Guardian — trust the process and stay consistent.

**Remember:** I'm here to guide, not to give answers. The learning is in the doing.`,
];

// ── Keyword matching ──

const TOPIC_KEYWORDS: Record<string, string[]> = {
  recon: ["recon", "nmap", "scan", "port", "discovery", "enumeration", "fingerprint", "osint", "whois", "dns"],
  web: ["web", "xss", "csrf", "sqli", "sql", "injection", "http", "https", "cookie", "session", "api", "rest"],
  exploit: ["exploit", "vulnerability", "cve", "buffer overflow", "rce", "remote code", "privilege escalation", "payload", "shell"],
  network: ["network", "tcp", "udp", "ip", "firewall", "router", "subnet", "vlan", "protocol", "packet"],
  defense: ["defense", "blue team", "soc", "monitoring", "detection", "siem", "ids", "ips", "incident response", "threat hunting"],
  crypto: ["crypto", "encryption", "tls", "ssl", "certificate", "hash", "aes", "rsa", "cipher", "symmetric", "asymmetric"],
  password: ["password", "hash", "brute force", "credential", "login", "auth", "authentication", "oauth", "jwt", "token"],
  malware: ["malware", "virus", "worm", "trojan", "ransomware", "rootkit", "backdoor", "payload", "dropper"],
  cloud: ["cloud", "aws", "azure", "gcp", "kubernetes", "docker", "container", "serverless", "s3", "iam"],
  mobile: ["mobile", "android", "ios", "app", "mobile app", "insecure storage", "root detection"],
  social: ["phishing", "social engineering", "vishing", "smishing", "pretexting", "baiting"],
  forensics: ["forensic", "memory", "disk", "artifact", "timeline", "triage", "evidence", "chain of custody"],
  career: ["career", "job", "certification", "roadmap", "learn", "study", "path", "skill", "training"],
};

const detectTopic = (message: string): string | undefined => {
  const lower = message.toLowerCase();
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return topic;
  }
  return undefined;
};

const detectSkillLevel = (message: string): "beginner" | "intermediate" | "advanced" => {
  const lower = message.toLowerCase();
  const beginnerHints = ["what is", "how do i start", "beginner", "new to", "explain like", "novice", "basic", "fundamental"];
  const advancedHints = ["advanced", "bypass", "evasion", "bypassing", "zero-day", "exploit chain", "payload development", "callback"];

  if (advancedHints.some((h) => lower.includes(h))) return "advanced";
  if (beginnerHints.some((h) => lower.includes(h))) return "beginner";
  return "intermediate";
};

const detectType = (message: string): MentorResponse["type"] => {
  const lower = message.toLowerCase();
  const analysisHints = ["analyze", "analyze", "assess", "evaluate", "review", "what do you think", "how secure", "is this safe"];
  const guidanceHints = ["how to", "how do i", "guide", "steps", "walkthrough", "tutorial", "help me", "show me"];
  const debriefHints = ["debrief", "progress", "feedback", "review my", "am i", "assessment", "where am i"];

  if (analysisHints.some((h) => lower.includes(h))) return "analysis";
  if (guidanceHints.some((h) => lower.includes(h))) return "guidance";
  if (debriefHints.some((h) => lower.includes(h))) return "debrief";
  return "explanation";
};

// ── Suggestion generators ──

const getFollowUpSuggestions = (topic?: string): string[] => {
  const common = [
    "Explain this in simpler terms",
    "Give me a practical exercise for this",
    "What are the common mistakes to avoid?",
    "How does this relate to real-world scenarios?",
    "Show me the next mission in this area",
  ];

  const topicSpecific: Record<string, string[]> = {
    recon: ["Walk me through a full reconnaissance workflow", "What tools should I use for passive recon?", "How do I interpret scan results?"],
    web: ["Show me common web vulnerability examples", "How do I test for XSS effectively?", "What's the difference between stored and reflected XSS?"],
    exploit: ["Walk me through an exploit development workflow", "What's the difference between local and remote exploitation?", "How do I chain multiple vulnerabilities?"],
    defense: ["How do I set up effective monitoring?", "What are the key indicators of compromise?", "Walk me through incident response steps"],
    network: ["Explain the OSI model in security context", "How do firewalls work at different layers?", "What's defense in depth for networks?"],
    crypto: ["Explain common cryptographic failures", "When should I use symmetric vs asymmetric encryption?", "How do TLS handshakes work?"],
    forensics: ["Walk me through a forensic investigation", "What artifacts are most valuable?", "How do I maintain chain of custody?"],
    career: ["What certifications should I pursue?", "How do I build a home lab for practice?", "What skills are most in demand?"],
  };

  if (topic && topicSpecific[topic]) {
    return [...topicSpecific[topic], ...common].slice(0, 5);
  }
  return common;
};

// ── Main generation function ──

const pickTemplate = <T>(templates: ((ctx: MentorContext) => T)[]): ((ctx: MentorContext) => T) => {
  return templates[Math.floor(Math.random() * templates.length)];
};

export const generateLocalMentorResponse = (userMessage: string, context?: Partial<MentorContext>): MentorResponse => {
  const message = userMessage.trim();
  const topic = context?.topic || detectTopic(message);
  const skillLevel = context?.skillLevel || detectSkillLevel(message);
  const responseType = detectType(message);

  const fullContext: MentorContext = {
    topic,
    skillLevel,
    missionTitle: context?.missionTitle,
    missionPhase: context?.missionPhase,
    userMessage: message,
  };

  let text: string;

  switch (responseType) {
    case "analysis":
      text = pickTemplate(ANALYSIS_TEMPLATES)(fullContext);
      break;
    case "guidance":
      text = pickTemplate(GUIDANCE_TEMPLATES)(fullContext);
      break;
    case "debrief":
      text = pickTemplate(DEBRIEF_TEMPLATES)(fullContext);
      break;
    default:
      text = pickTemplate(EXPLANATION_TEMPLATES)(fullContext);
  }

  const suggestions = getFollowUpSuggestions(topic);

  // Add a fallback header
  const response: MentorResponse = {
    text: `**[Local Mentor Mode — AI backend unavailable]**

${text}

---

*ZORVIX is operating in local fallback mode. Live AI responses will resume once the backend is reachable. Your progress and data are preserved.*`,
    suggestions,
    type: responseType,
  };

  return response;
};

/**
 * Simulate a streaming local response (chunk by chunk).
 * Returns an async generator that yields text chunks with realistic timing.
 */
export async function* streamLocalMentorResponse(
  userMessage: string,
  context?: Partial<MentorContext>
): AsyncGenerator<string, MentorResponse, void> {
  const response = generateLocalMentorResponse(userMessage, context);
  const words = response.text.split(" ");

  // Simulate typing by yielding chunks
  let current = "";
  for (let i = 0; i < words.length; i++) {
    current += (i > 0 ? " " : "") + words[i];
    // Yield every few words with variable timing
    if (i % 3 === 2 || i === words.length - 1) {
      yield current;
      await new Promise((resolve) => setTimeout(resolve, 15 + Math.random() * 25));
      current = "";
    }
  }

  return response;
}
