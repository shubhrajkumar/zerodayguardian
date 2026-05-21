import fs from "node:fs";
import path from "node:path";

const knowledgePath = path.resolve(process.cwd(), "backend", "data", "knowledge-base.json");
let cachedMtimeMs = 0;
let cachedEntries = [];

const normalize = (value = "") => String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const tokens = (value = "") => normalize(value).split(" ").filter((item) => item.length > 2);
const FAQ_PREFIXES = [
  "what is",
  "what are",
  "explain",
  "tell me about",
  "give me",
  "show me",
  "summary of",
  "overview of",
  "define",
];

const isFaqStyleQuery = (text = "") => {
  if (!text) return false;
  return FAQ_PREFIXES.some((prefix) => text.startsWith(prefix));
};

const loadEntries = () => {
  try {
    const stat = fs.statSync(knowledgePath);
    if (stat.mtimeMs === cachedMtimeMs && cachedEntries.length) return cachedEntries;
    const raw = JSON.parse(fs.readFileSync(knowledgePath, "utf8"));
    cachedEntries = Array.isArray(raw) ? raw : [];
    cachedMtimeMs = stat.mtimeMs;
    return cachedEntries;
  } catch {
    cachedEntries = [];
    cachedMtimeMs = 0;
    return cachedEntries;
  }
};

const shouldMatchEntry = (entry, text, queryTokens) => {
  if (!entry || !text) return false;
  if (entry.id === "owasp-top-10") {
    const hasOwaspToken = text.includes("owasp") || queryTokens.includes("owasp");
    const hasTopTenPhrase =
      text.includes("top 10") ||
      text.includes("top ten") ||
      (queryTokens.includes("top") && (queryTokens.includes("10") || queryTokens.includes("ten")));
    const explicitOwaspIntent =
      hasOwaspToken ||
      hasTopTenPhrase ||
      text.includes("owasp top 10") ||
      text.includes("web app risk") ||
      text.includes("web application risk");
    return explicitOwaspIntent;
  }
  if (entry.id === "debug-500") {
    const has500Signal =
      /\b500\b/.test(text) ||
      text.includes("internal server error") ||
      text.includes("backend 500") ||
      text.includes("api 500");
    const hasDebugIntent =
      text.includes("debug") ||
      text.includes("fix") ||
      text.includes("error") ||
      text.includes("route") ||
      queryTokens.includes("debug");
    return has500Signal && hasDebugIntent;
  }
  return true;
};

const scoreEntry = (entry, queryTokens, text) => {
  let score = 0;
  const keywords = Array.isArray(entry.keywords) ? entry.keywords.map((item) => normalize(item)) : [];
  const patterns = Array.isArray(entry.patterns) ? entry.patterns.map((item) => normalize(item)) : [];
  for (const keyword of keywords) {
    if (queryTokens.includes(keyword) || text.includes(keyword)) score += 3;
  }
  for (const pattern of patterns) {
    if (pattern && text.includes(pattern)) score += 5;
  }
  if (entry.title && text.includes(normalize(entry.title))) score += 2;
  return score;
};

export const searchJsonKnowledge = ({ query = "", limit = 3 } = {}) => {
  const text = normalize(query);
  if (!text) return [];
  const queryTokens = tokens(query);
  return loadEntries()
    .filter((entry) => shouldMatchEntry(entry, text, queryTokens))
    .map((entry) => ({ ...entry, score: scoreEntry(entry, queryTokens, text) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

export const resolveJsonKnowledgeReply = ({ query = "" } = {}) => {
  const normalizedQuery = normalize(query);
  const matches = searchJsonKnowledge({ query, limit: 3 });
  if (!matches.length) return null;
  const [top] = matches;
  if (Number(top.score || 0) < 3) return null;
  if (top.id === "owasp-top-10") {
    const explicitOwaspQuestion =
      normalizedQuery.includes("owasp") ||
      normalizedQuery.includes("owasp top 10") ||
      normalizedQuery.includes("top 10") ||
      normalizedQuery.includes("top ten");
    if (!explicitOwaspQuestion || !isFaqStyleQuery(normalizedQuery)) return null;
  }
  const bullets = Array.isArray(top.bullets) ? top.bullets.slice(0, 4) : [];
  const cleanAnswer = String(top.answer || "").trim();
  const response = [
    cleanAnswer,
    ...bullets.map((item) => `- ${item}`),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
  return {
    source: "knowledge_db",
    text: response,
    entry: top,
    matches,
  };
};
