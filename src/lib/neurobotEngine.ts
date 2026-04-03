import { LearningResource, resourceCatalog } from "@/data/resourceCatalog";

export type NeuroRole = "user" | "assistant";

export interface NeuroMessage {
  id: string;
  role: NeuroRole;
  content: string;
  timestamp: number;
}

export interface NeuroTopicContext {
  id: string;
  title: string;
  query: string;
  tags: string[];
}

export interface NeuroMemory {
  messages: NeuroMessage[];
  interests: string[];
  activeTopic?: NeuroTopicContext;
}

export interface NeuroReply {
  message: string;
  resources: LearningResource[];
  learningPath: string[];
  suggestions: string[];
}

const defaultPaths: Record<string, string[]> = {
  "application security": [
    "Understand OWASP Top 10 and ASVS controls.",
    "Practice with hands-on web labs and exploit walkthroughs.",
    "Create a secure coding checklist for your stack.",
    "Review findings and map recurring weaknesses to remediation playbooks.",
  ],
  "threat intelligence": [
    "Start with ATT&CK tactics and technique mapping.",
    "Track active advisories and exploited vulnerabilities.",
    "Build threat hypotheses linked to your environment.",
    "Convert findings into SOC detections and response runbooks.",
  ],
  "cloud security": [
    "Define shared responsibility and asset inventory.",
    "Harden identity, network segmentation, and workload policies.",
    "Apply Kubernetes and cloud-native security best practices.",
    "Monitor posture continuously and prioritize high-impact gaps.",
  ],
  "incident response": [
    "Prepare triage playbooks and clear severity models.",
    "Detect, contain, and preserve forensic evidence quickly.",
    "Coordinate communication and recovery checkpoints.",
    "Run post-incident review and prevention hardening loop.",
  ],
  malware: [
    "Start with static and dynamic malware analysis fundamentals.",
    "Practice with sandboxed samples and network behavioral analysis.",
    "Map findings to detection signatures and SOC workflows.",
    "Build repeatable triage and escalation criteria.",
  ],
  phishing: [
    "Learn email threat patterns and social engineering indicators.",
    "Practice link, attachment, and header analysis in labs.",
    "Build phishing detection and reporting workflows.",
    "Reinforce with awareness exercises and response playbooks.",
  ],
  nmap: [
    "Master host discovery and targeted port scanning strategy.",
    "Learn service version detection and scriptable enumeration.",
    "Use NSE scripts for focused vulnerability assessment.",
    "Document findings and convert reconnaissance into action plans.",
  ],
  automation: [
    "Identify repetitive security tasks worth automating first.",
    "Build Python-based workflows for triage and enrichment.",
    "Integrate alerts, ticketing, and response orchestration safely.",
    "Measure outcome quality and reduce manual effort iteratively.",
  ],
};

const generalSuggestions = [
  "Create a 30-day learning plan",
  "Show beginner-friendly resources",
  "How to start with incident response",
  "Best web security labs today",
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();

const tokenize = (value: string) => normalize(value).split(/\s+/).filter(Boolean);

const scoreResource = (resource: LearningResource, text: string, tags: string[]): number => {
  const tokens = new Set([...tokenize(text), ...tags.flatMap(tokenize)]);
  const corpus = `${resource.title} ${resource.summary} ${resource.tags.join(" ")}`.toLowerCase();
  let score = 0;
  tokens.forEach((token) => {
    if (corpus.includes(token)) score += 1;
  });
  return score;
};

const inferDomain = (query: string, topic?: NeuroTopicContext): string => {
  const q = normalize(query);
  if (topic?.title) return normalize(topic.title);
  if (q.includes("malware")) return "malware";
  if (q.includes("phishing") || q.includes("email")) return "phishing";
  if (q.includes("nmap") || q.includes("scan") || q.includes("enumeration")) return "nmap";
  if (q.includes("automation") || q.includes("workflow") || q.includes("soar")) return "automation";
  if (q.includes("incident") || q.includes("forensic") || q.includes("soc")) return "incident response";
  if (q.includes("cloud") || q.includes("kubernetes") || q.includes("devsecops")) return "cloud security";
  if (q.includes("threat") || q.includes("mitre") || q.includes("intel")) return "threat intelligence";
  if (q.includes("web") || q.includes("owasp") || q.includes("appsec") || q.includes("secure coding")) {
    return "application security";
  }
  return "application security";
};

const buildResourceSet = (query: string, topic?: NeuroTopicContext): LearningResource[] => {
  const tags = topic?.tags ?? [];
  return [...resourceCatalog]
    .map((resource) => ({ resource, score: scoreResource(resource, query, tags) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.resource);
};

const buildReplyMessage = (domain: string, query: string, resources: LearningResource[]): string => {
  const intro =
    "Here is a focused answer tailored to your question with practical next actions and trusted references.";
  const action =
    domain === "malware"
      ? "Start with controlled sample analysis, then map artifacts to practical detections."
      : domain === "phishing"
      ? "Start with phishing triage signals, then practice detection and containment workflows."
      : domain === "nmap"
      ? "Start with scoped discovery, then progress into precise enumeration and scripting."
      : domain === "automation"
      ? "Start by automating one high-friction workflow and measuring operational gains."
      : domain === "incident response"
      ? "Start by defining containment triggers, escalation ownership, and recovery checkpoints."
      : domain === "cloud security"
      ? "Start with identity hardening, policy enforcement, and workload visibility baselines."
      : domain === "threat intelligence"
      ? "Start by mapping attacker techniques to your detection and response coverage."
      : "Start by mapping common application risks to a repeatable secure development workflow.";
  const resourceLine = resources.length
    ? `I also matched ${resources.length} high-quality references relevant to "${query}".`
    : "I can provide a step-by-step learning path if you share your current level and goal.";

  return `${intro}\n\n${action}\n\n${resourceLine}`;
};

export const buildNeuroReply = (
  query: string,
  memory: NeuroMemory,
  topicOverride?: NeuroTopicContext
): NeuroReply => {
  const activeTopic = topicOverride ?? memory.activeTopic;
  const domain = inferDomain(query, activeTopic);
  const resources = buildResourceSet(query, activeTopic);
  const learningPath = defaultPaths[domain] ?? defaultPaths["application security"];
  const suggestions = activeTopic
    ? [
        `Deep dive: ${activeTopic.title}`,
        `Roadmap for ${activeTopic.title}`,
        "Show advanced references",
        "Summarize this topic in 5 steps",
      ]
    : generalSuggestions;

  return {
    message: buildReplyMessage(domain, query, resources),
    resources,
    learningPath,
    suggestions,
  };
};

export const createMessage = (role: NeuroRole, content: string): NeuroMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  timestamp: Date.now(),
});
