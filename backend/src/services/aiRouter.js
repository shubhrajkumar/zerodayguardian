const CYBER_KEYWORDS = [
  "cyber",
  "security",
  "vulnerability",
  "threat",
  "malware",
  "phishing",
  "xss",
  "sql injection",
  "ssrf",
  "csrf",
  "incident",
  "forensics",
  "breach",
  "cve",
  "pentest",
  "osint",
  "recon",
  "exploit",
  "endpoint",
  "firewall",
  "ids",
  "soc",
  "siem",
  "hardening",
  "ransomware",
  "zero day",
];

const LEARNING_KEYWORDS = ["learn", "teach", "explain", "guide", "roadmap", "study", "practice", "lab", "tutorial"];
const RESEARCH_KEYWORDS = ["research", "sources", "reference", "citations", "compare", "survey"];

const normalize = (value = "") => String(value || "").toLowerCase();

const lastUserMessage = (messages = []) =>
  [...messages].reverse().find((message) => message?.role === "user")?.content || "";

const hasCyberKeywords = (text = "") => CYBER_KEYWORDS.some((keyword) => text.includes(keyword));
const hasLearningIntent = (text = "") => LEARNING_KEYWORDS.some((keyword) => text.includes(keyword));
const hasResearchIntent = (text = "") => RESEARCH_KEYWORDS.some((keyword) => text.includes(keyword));

const topicLooksCyber = (topic = null) => {
  if (!topic) return false;
  const title = normalize(topic.title || "");
  const tags = Array.isArray(topic.tags) ? topic.tags.map((tag) => normalize(tag)) : [];
  return hasCyberKeywords(title) || tags.some((tag) => hasCyberKeywords(tag));
};

export const selectAiRoute = ({ messages = [], attachments = [], topic = null } = {}) => {
  const query = normalize(lastUserMessage(messages));
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  const wantsResearch = hasResearchIntent(query);
  const wantsLearning = hasLearningIntent(query);

  if (hasAttachments) {
    return {
      mode: "file_analysis",
      toolIds: ["attachment-module"],
      reason: "attachments_detected",
    };
  }

  if (hasCyberKeywords(query) || topicLooksCyber(topic)) {
    return {
      mode: "cybersecurity",
      toolIds: [
        "cyber-analysis-module",
        ...(wantsResearch ? ["research-module", "search-module"] : []),
      ],
      reason: "cybersecurity_detected",
    };
  }

  if (wantsLearning) {
    return {
      mode: "general",
      toolIds: ["learning-assistant-module"],
      reason: "learning_intent",
    };
  }

  if (wantsResearch) {
    return {
      mode: "general",
      toolIds: ["search-module", "research-module"],
      reason: "research_intent",
    };
  }

  return {
    mode: "general",
    toolIds: [],
    reason: "default",
  };
};

export const isCybersecurityTopic = (input = "") => hasCyberKeywords(normalize(input));
