const MAX_BULLETS = 5;
const MAX_STEPS = 4;
const TITLE_MAX = 80;

const clean = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

const splitSentences = (text = "") => {
  const normalized = clean(text);
  if (!normalized) return [];
  const parts = normalized.split(/([.!?])\s+/);
  const sentences = [];
  for (let i = 0; i < parts.length; i += 2) {
    const chunk = parts[i] || "";
    const punctuation = parts[i + 1] || "";
    const sentence = `${chunk}${punctuation}`.trim();
    if (sentence) sentences.push(sentence);
  }
  return sentences;
};

const extractBullets = (lines = []) =>
  lines
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);

const isPreformatted = (text = "") => /(^#\s|^##\s|^###\s|^\*\*.+\*\*)/m.test(text);

const titleFromMode = (mode = "") => {
  if (mode === "file_analysis") return "File Analysis";
  if (mode === "cybersecurity") return "Security Guidance";
  return "Zorvix Response";
};

const tipFromMode = (mode = "") => {
  if (mode === "file_analysis") return "If you want deeper analysis, upload any related context or logs.";
  if (mode === "cybersecurity") return "Confirm scope and authorization before taking any defensive action.";
  return "Ask for a checklist or example if you want a more practical next step.";
};

const toBulletLines = (items = []) => items.map((item) => `• ${item}`);

export const formatAssistantResponse = ({ text = "", mode = "general" } = {}) => {
  const raw = String(text || "").trim();
  if (!raw) return "";
  if (isPreformatted(raw)) return raw;

  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bullets = extractBullets(lines.filter((line) => /^[-*•]/.test(line)));
  const sentences = splitSentences(raw);

  const titleCandidate = sentences[0] && sentences[0].length <= TITLE_MAX ? sentences[0].replace(/[:.]$/, "") : "";
  const title = titleCandidate || titleFromMode(mode);
  const explanation = sentences.slice(titleCandidate ? 1 : 0).slice(0, 2).join(" ");

  const fallbackBullets = sentences.slice(titleCandidate ? 2 : 1).slice(0, MAX_BULLETS);
  const bulletItems = (bullets.length ? bullets : fallbackBullets).slice(0, MAX_BULLETS);

  const stepLines = lines.filter((line) => /^\d+\./.test(line)).map((line) => line.replace(/^\d+\.\s*/, "").trim());
  const steps = stepLines.slice(0, MAX_STEPS);

  const tipLine = tipFromMode(mode);

  return [
    `**${title}**`,
    explanation || "Here is a concise summary based on your request.",
    "",
    "**Key points** ✨",
    ...toBulletLines(
      bulletItems.length
        ? bulletItems.map((item) => (item.length > 0 ? item : "Key detail captured for your request."))
        : ["Key detail captured for your request."]
    ),
    steps.length ? "" : null,
    steps.length ? "**Steps** 🧭" : null,
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "**Helpful tip** 💡",
    tipLine,
  ]
    .filter(Boolean)
    .join("\n");
};
