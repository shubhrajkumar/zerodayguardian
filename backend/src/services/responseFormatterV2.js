const MAX_BULLETS = 4;
const MAX_STEPS = 3;
const TITLE_MAX = 68;
const SUMMARY_MAX = 180;
const BULLET_MAX = 150;

const clean = (value = "") => String(value || "").replace(/\s+/g, " ").trim();
const normalizeKey = (value = "") =>
  clean(value)
    .toLowerCase()
    .replace(/[*_`#>~]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim();

const uniqueItems = (items = []) => {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const value = clean(item);
    if (!value) continue;
    const key = normalizeKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
};

const shorten = (value = "", max = SUMMARY_MAX) => {
  const text = clean(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trim()}...`;
};

const splitSentences = (text = "") => {
  const normalized = clean(text);
  if (!normalized) return [];
  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
};

const isPreformatted = (text = "") => /(^#\s|^##\s|^###\s|^\*\*.+\*\*|^- )/m.test(text);

const extractBullets = (lines = []) =>
  lines
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);

const inferMode = (mode = "") => String(mode || "").toLowerCase();

const hashSeed = (value = "") => {
  let hash = 0;
  const text = clean(value);
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const pickLabel = (mode = "", seed = 0) => {
  const normalized = inferMode(mode);
  const bucket = seed % 3;
  if (normalized === "operator" || normalized === "mentor" || normalized === "cyber_ops") {
    return bucket === 0
      ? { title: "ZORVIX Brief", next: "Validation", key: "Operational Signals", risk: "Risk" }
      : bucket === 1
        ? { title: "Mission Debrief", next: "Validation", key: "What Matters", risk: "Risk" }
        : { title: "Operator Summary", next: "Validation", key: "Key Signals", risk: "Risk" };
  }
  if (normalized === "cybersecurity") {
    return bucket === 0
      ? { title: "Security Answer", next: "Validation", key: "Key Signals", risk: "Risk" }
      : bucket === 1
        ? { title: "Security Brief", next: "Validation", key: "Operational Signals", risk: "Risk" }
        : { title: "Security Summary", next: "Validation", key: "Key Signals", risk: "Risk" };
  }
  if (normalized === "file_analysis") {
    return bucket === 0
      ? { title: "Quick Analysis", next: "Validation", key: "Key Signals", risk: "Risk" }
      : bucket === 1
        ? { title: "File Analysis", next: "Validation", key: "Key Signals", risk: "Risk" }
        : { title: "Analysis Summary", next: "Validation", key: "Key Signals", risk: "Risk" };
  }
  return bucket === 0
    ? { title: "Quick Answer", next: "Validation", key: "Key Signals", risk: "Risk" }
    : bucket === 1
      ? { title: "Direct Answer", next: "Validation", key: "Key Signals", risk: "Risk" }
      : { title: "Summary", next: "Validation", key: "Key Signals", risk: "Risk" };
};

const toBulletLines = (items = []) => uniqueItems(items).slice(0, MAX_BULLETS).map((item) => `- ${shorten(item, BULLET_MAX)}`);

const filterRepeatingBullets = ({ title = "", summary = "", bullets = [] }) => {
  const titleKey = normalizeKey(title);
  const summaryKey = normalizeKey(summary);
  return uniqueItems(bullets).filter((item) => {
    const key = normalizeKey(item);
    if (!key) return false;
    if (titleKey && (key === titleKey || key.includes(titleKey))) return false;
    if (summaryKey && (key === summaryKey || key.includes(summaryKey))) return false;
    return true;
  });
};

export const formatAssistantResponse = ({ text = "", mode = "general", variantSeed = "" } = {}) => {
  const raw = String(text || "").replace(/\0/g, "").trim();
  if (!raw) return "";
  if (isPreformatted(raw)) return raw;

  const seed = hashSeed(`${variantSeed || ""}::${raw}`);
  const meta = pickLabel(mode, seed);
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const explicitBullets = extractBullets(lines.filter((line) => /^\s*[-*]\s*/.test(line)));
  const explicitSteps = uniqueItems(
    lines
      .filter((line) => /^\d+\./.test(line))
      .map((line) => line.replace(/^\d+\.\s*/, "").trim())
  ).slice(0, MAX_STEPS);
  const nextActionLine =
    lines.find((line) => /^next action[:\-]/i.test(line))?.replace(/^next action[:\-]\s*/i, "").trim() ||
    lines.find((line) => /^recommended step[:\-]/i.test(line))?.replace(/^recommended step[:\-]\s*/i, "").trim() ||
    lines.find((line) => /^next step[:\-]/i.test(line))?.replace(/^next step[:\-]\s*/i, "").trim() ||
    "";
  const riskLine = lines.find((line) => /^risk[:\-]/i.test(line))?.replace(/^risk[:\-]\s*/i, "").trim() || "";
  const validationLine =
    lines.find((line) => /^validation[:\-]/i.test(line))?.replace(/^validation[:\-]\s*/i, "").trim() ||
    lines.find((line) => /^evidence[:\-]/i.test(line))?.replace(/^evidence[:\-]\s*/i, "").trim() ||
    "";

  const sentences = splitSentences(raw);
  const firstSentence = sentences[0] || "";
  const derivedTitle =
    firstSentence && firstSentence.length <= TITLE_MAX
      ? firstSentence.replace(/[.!?:]+$/, "")
      : meta.title;

  const remaining = sentences.slice(firstSentence && firstSentence.length <= TITLE_MAX ? 1 : 0);
  const summary = shorten(remaining[0] || firstSentence || "Here is the clearest answer from the available context.", SUMMARY_MAX);
  const fallbackBullets = remaining.slice(1).length ? remaining.slice(1) : remaining.slice(0, 3);
  const bulletItems = filterRepeatingBullets({
    title: derivedTitle,
    summary,
    bullets: explicitBullets.length ? explicitBullets : fallbackBullets,
  }).slice(0, MAX_BULLETS);

  const sections = [];
  if (raw.length <= 120 && !explicitBullets.length && !nextActionLine && !riskLine && !validationLine) {
    return raw;
  }
  sections.push(`**${derivedTitle || meta.title}**`, summary);

  if (bulletItems.length) {
    sections.push("", `**${meta.key}**`, ...toBulletLines(bulletItems));
  }

  if (nextActionLine) {
    sections.push("", "**Next Action**", `- ${shorten(nextActionLine, BULLET_MAX)}`);
  }

  if (riskLine) {
    sections.push("", `**${meta.risk || "Risk"}**`, `- ${shorten(riskLine, BULLET_MAX)}`);
  }

  if (validationLine) {
    sections.push("", `**${meta.next}**`, `- ${shorten(validationLine, BULLET_MAX)}`);
  }

  if (explicitSteps.length && !validationLine) {
    sections.push("", `**${meta.next}**`, ...explicitSteps.map((step, index) => `${index + 1}. ${shorten(step, 120)}`));
  }

  return sections.filter(Boolean).join("\n");
};
