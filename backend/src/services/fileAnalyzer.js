import { createHash } from "node:crypto";

let sharpLoader = null;
const loadSharp = async () => {
  if (sharpLoader) return sharpLoader;
  sharpLoader = import("sharp")
    .then((mod) => mod.default || mod)
    .catch(() => null);
  return sharpLoader;
};

let pdfParseLoader = null;
const loadPdfParse = async () => {
  if (pdfParseLoader) return pdfParseLoader;
  pdfParseLoader = import("pdf-parse")
    .then((mod) => mod.default || mod)
    .catch(() => null);
  return pdfParseLoader;
};

const TEXT_MIME_HINTS = [
  "text/",
  "application/json",
  "application/xml",
  "application/x-yaml",
  "text/x-",
  "application/javascript",
  "application/x-javascript",
];

const CODE_KEYWORDS = ["function ", "class ", "import ", "export ", "#include", "def ", "public ", "private "];
const LOG_PATTERNS = [
  /\b\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/,
  /\bINFO\b|\bWARN\b|\bERROR\b|\bDEBUG\b/,
];
const SECRET_PATTERNS = [
  /\bapi[_-]?key\b/i,
  /\bsecret\b/i,
  /\btoken\b/i,
  /\bpassword\b/i,
  /\baccess[_-]?key\b/i,
  /\bclient[_-]?secret\b/i,
];
const PDF_TEXT_MAX = 2000;
const TEXT_SAMPLE_MAX = 1200;

const decodeBase64 = (value = "") => {
  try {
    return Buffer.from(String(value || ""), "base64");
  } catch {
    return null;
  }
};

const normalize = (value = "") => String(value || "").trim();
const normalizeMime = (value = "") => String(value || "").toLowerCase();

const getExtension = (filename = "") => {
  const match = String(filename || "").toLowerCase().match(/\.([a-z0-9]+)$/i);
  return match?.[1] || "";
};

const isTextLike = (mime = "", extension = "") => {
  if (!mime && !extension) return false;
  if (TEXT_MIME_HINTS.some((hint) => mime.startsWith(hint) || mime === hint)) return true;
  return ["txt", "md", "csv", "json", "log", "yaml", "yml", "xml", "html", "js", "ts", "py", "go", "rs"].includes(extension);
};

const detectKind = (mime = "", extension = "") => {
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) return "image";
  if (mime === "application/pdf" || extension === "pdf") return "pdf";
  if (isTextLike(mime, extension)) return "text";
  return "file";
};

const hashBuffer = (buffer) => {
  if (!buffer || buffer.length === 0) return "";
  return createHash("sha256").update(buffer).digest("hex").slice(0, 12);
};

const extractTextStats = (text = "") => {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const length = text.length;
  const isCode = CODE_KEYWORDS.some((keyword) => text.includes(keyword));
  const isLog = LOG_PATTERNS.some((pattern) => pattern.test(text));
  return { lines: lines.length, length, isCode, isLog };
};

const detectSensitiveIndicators = (text = "") =>
  SECRET_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => String(pattern));

const summarizeText = (text = "") => {
  const snippet = normalize(text).slice(0, TEXT_SAMPLE_MAX);
  if (!snippet) return "";
  return snippet.length < text.length ? `${snippet}...` : snippet;
};

const buildTextObservations = ({ stats, snippet }) => {
  const observations = [];
  if (stats.lines) observations.push(`Contains about ${stats.lines} non-empty lines.`);
  if (stats.isCode) observations.push("Appears to be source code or script content.");
  if (stats.isLog) observations.push("Looks like a log or event trace.");
  if (snippet) observations.push("Text sample extracted for analysis.");
  return observations;
};

const buildFileActions = ({ kind, hasSensitive = false }) => {
  const actions = [];
  if (kind === "image") actions.push("Confirm the image source before sharing or embedding it.");
  if (kind === "pdf") actions.push("Check for sensitive data before redistributing the document.");
  if (kind === "text") actions.push("Review the extracted text for secrets or personally identifiable information.");
  if (hasSensitive) actions.push("Rotate any exposed keys or credentials and remove them from the file.");
  if (!actions.length) actions.push("Clarify the desired outcome so the analysis can focus on the right checks.");
  return actions;
};

const bufferToLatin1 = (buffer) => {
  if (!buffer) return "";
  try {
    return buffer.toString("latin1");
  } catch {
    return "";
  }
};

const extractPdfMetadata = (buffer) => {
  const raw = bufferToLatin1(buffer);
  if (!raw) return { pages: 0, title: "", author: "", creator: "", producer: "" };
  const pick = (pattern) => raw.match(pattern)?.[1]?.replace(/\s+/g, " ").trim() || "";
  const pages = (raw.match(/\/Type\s*\/Page\b/g) || []).length;
  return {
    pages,
    title: pick(/\/Title\s*\(([^)]{0,180})\)/),
    author: pick(/\/Author\s*\(([^)]{0,140})\)/),
    creator: pick(/\/Creator\s*\(([^)]{0,140})\)/),
    producer: pick(/\/Producer\s*\(([^)]{0,140})\)/),
  };
};

const extractPdfText = (buffer) => {
  const raw = bufferToLatin1(buffer);
  if (!raw) return "";
  const textObjects = raw.match(/BT[\s\S]*?ET/g) || [];
  const fragments = [];
  for (const block of textObjects.slice(0, 40)) {
    const matches = block.match(/\(([^)]{1,200})\)/g) || [];
    for (const match of matches) {
      const cleaned = match
        .slice(1, -1)
        .replace(/\\n/g, " ")
        .replace(/\\r/g, " ")
        .replace(/\\t/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (cleaned) fragments.push(cleaned);
    }
    if (fragments.join(" ").length > PDF_TEXT_MAX) break;
  }
  return fragments.join(" ").slice(0, PDF_TEXT_MAX);
};

const analyzeImage = async ({ buffer }) => {
  const sharp = await loadSharp();
  if (!sharp || !buffer) return {};
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: Number(metadata.width || 0) || null,
      height: Number(metadata.height || 0) || null,
      format: String(metadata.format || "") || null,
    };
  } catch {
    return {};
  }
};

export const analyzeAttachment = async (file = {}) => {
  const filename = normalize(file.filename || file.name || "attachment");
  const mimeType = normalizeMime(file.mimeType || "");
  const extension = getExtension(filename);
  const buffer = decodeBase64(file.base64 || "");
  const size = Number(file.size || buffer?.length || 0) || 0;
  const kind = detectKind(mimeType, extension);
  const fingerprint = buffer ? hashBuffer(buffer) : "";

  let extractedText = "";
  let textStats = { lines: 0, length: 0, isCode: false, isLog: false };
  let imageMeta = {};
  let pdfMeta = {};

  if (kind === "text" && buffer) {
    extractedText = buffer.toString("utf8").replace(/\0/g, "");
    textStats = extractTextStats(extractedText);
  }

  if (kind === "pdf" && buffer) {
    let parsedText = "";
    let parsedMeta = {};
    const pdfParse = await loadPdfParse();
    if (pdfParse) {
      try {
        const parsed = await pdfParse(buffer);
        parsedText = String(parsed?.text || "");
        const info = parsed?.info || {};
        parsedMeta = {
          pages: Number(parsed?.numpages || 0) || 0,
          title: String(info?.Title || ""),
          author: String(info?.Author || ""),
          creator: String(info?.Creator || ""),
          producer: String(info?.Producer || ""),
        };
      } catch {
        parsedText = "";
        parsedMeta = {};
      }
    }
    const fallbackMeta = extractPdfMetadata(buffer);
    const fallbackText = extractPdfText(buffer);
    pdfMeta = {
      pages: parsedMeta.pages || fallbackMeta.pages,
      title: parsedMeta.title || fallbackMeta.title,
      author: parsedMeta.author || fallbackMeta.author,
      creator: parsedMeta.creator || fallbackMeta.creator,
      producer: parsedMeta.producer || fallbackMeta.producer,
    };
    extractedText = parsedText || fallbackText;
    textStats = extractTextStats(extractedText);
  }

  if (kind === "image") {
    imageMeta = await analyzeImage({ buffer });
  }

  const sensitiveIndicators = extractedText ? detectSensitiveIndicators(extractedText) : [];
  const summary = (() => {
    if (kind === "image") return "Image file detected with metadata extracted.";
    if (kind === "pdf") return "PDF document detected with basic metadata and text sampling.";
    if (kind === "text") return "Text-based file detected with sample content extracted.";
    return "Binary attachment detected. Limited automated parsing available.";
  })();

  const keyObservations = [
    ...buildTextObservations({ stats: textStats, snippet: extractedText }),
    imageMeta.width && imageMeta.height ? `Image resolution: ${imageMeta.width}x${imageMeta.height}.` : "",
    pdfMeta.pages ? `Estimated pages: ${pdfMeta.pages}.` : "",
    pdfMeta.title ? `Document title: ${pdfMeta.title}.` : "",
    pdfMeta.author ? `Author: ${pdfMeta.author}.` : "",
  ].filter(Boolean);

  const possibleIssues = [];
  if (sensitiveIndicators.length) possibleIssues.push("Potential secrets or credentials detected in the text.");
  if (kind === "pdf") possibleIssues.push("PDF text extraction may miss embedded content or images.");

  return {
    filename,
    mimeType,
    size,
    kind,
    fingerprint,
    summary,
    keyObservations,
    possibleIssues,
    suggestedActions: buildFileActions({ kind, hasSensitive: sensitiveIndicators.length > 0 }),
    extractedText: summarizeText(extractedText),
    extractedStats: textStats,
    imageMeta,
    pdfMeta,
    sensitiveIndicators,
  };
};

export const analyzeAttachments = async (attachments = []) => {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return { items: [], promptContext: "" };
  }

  const items = [];
  for (const file of attachments.slice(0, 3)) {
     
    items.push(await analyzeAttachment(file));
  }

  const promptContext = items
    .map((item) => {
      const lines = [
        `File: ${item.filename}`,
        `Type: ${item.mimeType || item.kind}`,
        `Size: ${Math.max(1, Math.round(Number(item.size || 0) / 1024))} KB`,
        item.summary ? `Summary: ${item.summary}` : "",
        item.extractedText ? `Extracted text: ${item.extractedText}` : "",
        item.keyObservations?.length ? `Observations: ${item.keyObservations.join(" ")}` : "",
        item.possibleIssues?.length ? `Possible issues: ${item.possibleIssues.join(" ")}` : "",
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n\n");

  return { items, promptContext };
};
