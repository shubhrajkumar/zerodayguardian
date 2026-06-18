import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  ReactNode,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bot,
  FileText,
  Loader2,
  Paperclip,
  RefreshCcw,
  Send,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ApiError, apiFetch, getStoredAccessToken } from "@/lib/apiClient";
import api from "@/lib/api";
import { NeuroMessage, NeuroTopicContext } from "@/lib/neurobotEngine";
import { useAuth } from "@/context/AuthContext";
import { useMissionSystem } from "@/context/MissionSystemApiContext";
import { safeArray } from "@/utils/safeData";
import { generateLocalMentorResponse } from "@/lib/localMentorEngine";
import { queryGroqDirect } from "@/lib/groqDirect";
import { parseTelemetryFromResponse, stripTelemetryBlock, vectorTrackLabel, RuntimeTelemetry } from "@/lib/telemetryTypes";

const ZORVIX_NAME = "ZORVIX";
const MENTOR_LABEL = "Personal Cyber Mentor";
const MENTOR_TAGLINE = "I assess, guide, and push you further — like a senior analyst mentoring a new operator.";
const MAX_ATTACHMENT_BYTES = 2_000_000;
const DEFAULT_ATTACHMENT_PROMPT = "Analyze this attachment from a cybersecurity perspective.";
const WELCOME_PATTERN = /^##\s*zorvi/i;
const STREAM_ERROR_TEXT = "The live stream was interrupted. ZORVIX kept the workspace stable, but please retry for a complete answer.";
const GROQ_DIRECT_MAX_LENGTH = 500;
const GROQ_DIRECT_TIMEOUT_MS = 15_000;

/** Hacker spinner — green blinking dots that pulse like a terminal activity indicator */
const HackerSpinner = () => (
  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/8 px-4 py-2 shadow-[0_0_12px_rgba(52,211,153,0.08)]">
    {[0, 1, 2].map((dot) => (
      <span
        key={dot}
        className="h-2 w-2 rounded-full bg-emerald-400"
        style={{
          animation: "hacker-pulse 1.2s ease-in-out infinite",
          animationDelay: `${dot * 0.2}s`,
          boxShadow: "0 0 6px rgba(52, 211, 153, 0.6)",
        }}
      />
    ))}
    <span className="text-xs font-mono font-medium tracking-wider text-emerald-300/90">
      ZORVIX is deciphering...
    </span>
  </div>
);

/** Heuristic: short, attachment-free messages route through the fast Groq endpoint. */
const isQuickQuery = (prompt: string, attachment: ChatAttachmentPayload | null) =>
  !attachment && prompt.length > 0 && prompt.length <= GROQ_DIRECT_MAX_LENGTH;
const DEFAULT_SUGGESTIONS = [
  "Debrief my current security learning state and expose my blind spots.",
  "Assess my cyber momentum and tell me the most important move today.",
  "Guide me through the next mission with tactical steps, risk, and validation.",
  "Think like a senior analyst — what am I missing in my current approach?",
  "Build a focused practice sprint for today based on my weakest skill.",
  "Compare my progress to the 60-day roadmap and tell me where to focus.",
];
const ATTACHMENT_ACCEPT = ".txt,.md,.csv,.json,.log,.pdf,.png,.jpg,.jpeg,.gif,.webp,text/plain,text/markdown,text/csv,application/json,application/pdf,image/png,image/jpeg,image/gif,image/webp";
const SUPPORTED_ATTACHMENT_EXTENSIONS = new Set(["txt", "md", "csv", "json", "log", "pdf", "png", "jpg", "jpeg", "gif", "webp"]);
const GENERAL_SUGGESTION_BANK = [
  "Ask about cybersecurity",
  "Generate research ideas",
  "Analyze a concept",
  "Explain a technical topic",
  "Turn the answer into a checklist",
  "Compare two safe approaches",
];
const CYBER_SUGGESTION_BANK = [
  "Map the main risks and attack paths.",
  "Show the highest-impact remediation steps.",
  "Turn this into an incident-response checklist.",
  "Explain the defensive meaning of these findings.",
  "Summarize the risk in plain English.",
];
const DEBUG_SUGGESTION_BANK = [
  "Break this into root cause, fix, and validation steps.",
  "Show the most likely causes first.",
  "Turn this into a debugging checklist.",
  "Explain the failure in plain English.",
  "List the next three checks to run safely.",
];
const RESEARCH_SUGGESTION_BANK = [
  "Generate research ideas and a validation plan.",
  "Build a weekly study sprint around this topic.",
  "Turn this into a learning roadmap with labs.",
  "Compare the strongest references to study next.",
  "Extract the key concepts and prerequisites.",
];
const ATTACHMENT_SUGGESTION_BANK = [
  "Summarize the uploaded file.",
  "List suspicious indicators in the attachment.",
  "Explain the file metadata and risks.",
  "Recommend the safest next steps for this upload.",
  "Turn the attachment review into an action checklist.",
];
const FOLLOW_UP_SUGGESTION_BANK = [
  "Summarize this in plain English.",
  "Turn this into a step-by-step checklist.",
  "Give me one safe lab exercise to practice this.",
  "Show the fastest way to validate this safely.",
  "Tell me what to ask next.",
];

type TransportType = "auto" | "sse" | "webrtc";

interface AssistantProfile {
  tone?: string;
  style?: string;
  audience?: string;
  transport?: TransportType;
  privateMode?: boolean;
}

interface SessionResponse {
  messages: NeuroMessage[];
  activeTopic?: NeuroTopicContext | null;
  assistantProfile?: AssistantProfile | null;
  fallback?: boolean;
  degraded?: boolean;
  llmError?: LlmErrorState | null;
}

interface LlmErrorState {
  code: string;
  title: string;
  detail: string;
  provider?: string;
  retryable?: boolean;
  retryAfterSec?: number | null;
  retryHint?: string;
  statusCode?: number;
}

interface ChatbotHealthResponse {
  status: "ok" | "degraded" | "down";
  latency?: number;
  model?: "active" | "down";
  websocket?: boolean;
  llm_ready?: boolean;
  reason?: string;
  provider?: string;
  mode?: "primary_live" | "fallback_active" | "local_fallback";
  fallback_ready?: boolean;
  summary?: string;
  retryAfterSec?: number;
  generatedAt?: string;
}

interface ChatAttachmentPayload {
  filename: string;
  mimeType: string;
  size: number;
  base64: string;
}

interface AttachmentPreview {
  kind: "image" | "pdf" | "text" | "file";
  previewUrl?: string;
  snippet?: string;
  extension?: string;
}

interface RetryState {
  prompt: string;
  topic: NeuroTopicContext | null;
  attachmentPayload: ChatAttachmentPayload | null;
  error: LlmErrorState | null;
}

interface NeuroTopicEvent extends NeuroTopicContext {
  mentorMode?: boolean;
  autoSubmit?: boolean;
  roadmapDay?: number;
}

const normalizeTopicPayload = (topic: Partial<NeuroTopicEvent> | null | undefined): NeuroTopicEvent | null => {
  if (!topic || typeof topic !== "object") return null;
  const rawTitle = String(topic.title || "").trim();
  const rawQuery = String(topic.query || "").trim();
  const tags = safeArray(topic.tags)
    .map((tag) => String(tag || "").trim())
    .filter(Boolean)
    .slice(0, 20);
  if (!rawTitle && !rawQuery) return null;
  const title = rawTitle || rawQuery.slice(0, 180) || "ZORVIX Topic";
  const idBase = String(topic.id || title || rawQuery || "zorvix-topic")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return {
    id: idBase || "zorvix-topic",
    title,
    query: rawQuery,
    tags,
    mentorMode: Boolean(topic.mentorMode),
    autoSubmit: typeof topic.autoSubmit === "boolean" ? topic.autoSubmit : undefined,
    roadmapDay: typeof topic.roadmapDay === "number" ? topic.roadmapDay : undefined,
  };
};

const DEFAULT_PROFILE: AssistantProfile = {
  tone: "friendly",
  style: "concise",
  audience: "general",
  transport: "sse",
  privateMode: false,
};

const createMessage = (role: "user" | "assistant", content: string, id = `${role}-${Date.now()}`): NeuroMessage => ({
  id,
  role,
  content,
  timestamp: Date.now(),
});

const parseSseBlock = (block: string) => {
  const lines = block.split("\n");
  let event = "message";
  let id = "";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("id:")) id = line.slice(3).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }

  return { event, id, data: dataLines.join("\n") };
};

const safeParseJson = (value: string) => {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const output = String(reader.result || "");
      const base64 = output.includes(",") ? output.split(",").pop() || "" : output;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });

const formatBytes = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / 104857.6) / 10} MB`;
};

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const compactWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const getFileExtension = (filename = "") => {
  const match = String(filename || "").toLowerCase().match(/\.([a-z0-9]+)$/i);
  return match?.[1] || "";
};

const isSupportedAttachment = (file: File) => {
  const mimeType = String(file.type || "").toLowerCase();
  const extension = getFileExtension(file.name);
  return mimeType.startsWith("text/") || SUPPORTED_ATTACHMENT_EXTENSIONS.has(extension) || mimeType === "application/pdf";
};

const getAttachmentKind = (file: Pick<File, "name" | "type">): AttachmentPreview["kind"] => {
  const mimeType = String(file.type || "").toLowerCase();
  const extension = getFileExtension(file.name);
  if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) return "image";
  if (mimeType === "application/pdf" || extension === "pdf") return "pdf";
  if (mimeType.startsWith("text/") || ["txt", "md", "csv", "json", "log"].includes(extension)) return "text";
  return "file";
};

const rotateSuggestions = (items: string[], cycle = 0, count = 3) => {
  if (!items.length) return [];
  return Array.from({ length: Math.min(count, items.length) }, (_, index) => items[(cycle + index) % items.length]);
};

const normalizeMessages = (messages: NeuroMessage[] = []) =>
  messages
    .map((message) => ({
      ...message,
      id: String(message.id || `${message.role}-${message.timestamp || Date.now()}`),
      content: String(message.content || ""),
      timestamp: Number(message.timestamp || Date.now()),
    }))
    .filter((message) => message.role === "user" || message.content.trim());

const getLatestAssistantText = (messages: NeuroMessage[] = []) =>
  [...messages].reverse().find((message) => message.role === "assistant" && message.content.trim())?.content || "";

const buildSuggestions = ({
  prompt,
  answer,
  topic,
  attachmentName = "",
  cycle = 0,
}: {
  prompt: string;
  answer: string;
  topic?: NeuroTopicContext | null;
  attachmentName?: string;
  cycle?: number;
}) => {
  const seed = `${prompt} ${answer} ${topic?.title || ""} ${attachmentName}`.toLowerCase();
  const suggestions = [
    topic?.title ? `Go deeper on ${topic.title}.` : "",
    topic?.title ? `Turn ${topic.title} into an action checklist.` : "",
  ].map((item) => item.trim()).filter(Boolean);

  const pools: string[][] = [];
  if (/attachment|upload|file|document|image|pdf|metadata/.test(seed)) pools.push(ATTACHMENT_SUGGESTION_BANK);
  if (/debug|backend|error|500|exception|trace|crash|freeze/.test(seed)) pools.push(DEBUG_SUGGESTION_BANK);
  if (/roadmap|learn|career|beginner|research|study|topic|concept/.test(seed)) pools.push(RESEARCH_SUGGESTION_BANK);
  if (/owasp|web|xss|sql|csrf|phishing|email|malware|nmap|recon|subdomain|headers|threat|cyber|security/.test(seed)) {
    pools.push(CYBER_SUGGESTION_BANK);
  }
  if (!pools.length) pools.push(GENERAL_SUGGESTION_BANK);

  pools.forEach((pool, poolIndex) => {
    rotateSuggestions(pool, cycle + poolIndex, 3).forEach((item) => suggestions.push(item));
  });
  rotateSuggestions(FOLLOW_UP_SUGGESTION_BANK, cycle + 1, 3).forEach((item) => suggestions.push(item));

  return suggestions.filter((item, index, list) => item && list.indexOf(item) === index).slice(0, 6);
};

const normalizeLlmErrorState = (value?: Partial<LlmErrorState> | null): LlmErrorState | null => {
  if (!value || !value.code) return null;
  const code = String(value?.code || "llm_unavailable").toLowerCase();
  const retryAfterSec = Number(value?.retryAfterSec || 0) || null;
  const provider = String(value?.provider || "");
  const providerHint = provider ? ` Source: ${provider}.` : "";

  if (code === "timeout") {
    return {
      code,
      title: value?.title || "Temporary response delay",
      detail:
        value?.detail ||
        `The live model took longer than expected, so ZORVIX kept the workspace stable and paused the reply.${providerHint}`.trim(),
      retryable: value?.retryable ?? true,
      retryAfterSec,
      retryHint: value?.retryHint || "Retry in a moment or ask a shorter follow-up.",
      provider,
      statusCode: Number(value?.statusCode || 0) || undefined,
    };
  }
  if (code === "service_busy") {
    return {
      code,
      title: value?.title || "Live model is syncing",
      detail:
        value?.detail ||
        "ZORVIX is keeping replies stable while the live model syncs in the background.",
      retryable: value?.retryable ?? true,
      retryAfterSec,
      retryHint:
        value?.retryHint ||
        (retryAfterSec ? `Live replies should resume in about ${Math.max(1, Math.ceil(retryAfterSec))}s.` : "Stable replies are active while live sync finishes."),
      provider: value?.provider || "local",
      statusCode: Number(value?.statusCode || 0) || undefined,
    };
  }
  if (code === "rate_limit") {
    return {
      code,
      title: value?.title || "Live model is cooling down",
      detail:
        value?.detail ||
        `ZORVIX is pacing live requests to keep replies stable.${providerHint}`.trim(),
      retryable: value?.retryable ?? true,
      retryAfterSec,
      retryHint:
        value?.retryHint ||
        (retryAfterSec
          ? `Live replies should resume in about ${Math.max(1, Math.ceil(retryAfterSec))}s.`
          : "Stable replies are active while live sync finishes."),
      provider,
      statusCode: Number(value?.statusCode || 0) || undefined,
    };
  }
  if (code === "circuit_open") {
    return {
      code,
      title: value?.title || "Live model is rebalancing",
      detail: value?.detail || `ZORVIX is routing through its stable path while live capacity rebalances.${providerHint}`.trim(),
      retryable: value?.retryable ?? true,
      retryAfterSec,
      retryHint: value?.retryHint || "Stable replies are active while live sync finishes.",
      provider,
      statusCode: Number(value?.statusCode || 0) || undefined,
    };
  }
  if (code === "forced_local_fallback") {
    return {
      code,
      title: value?.title || "Local fallback mode active",
      detail:
        value?.detail ||
        "ZORVIX switched to stable local guidance while live mode recovers.",
      retryable: value?.retryable ?? false,
      retryAfterSec,
      retryHint:
        value?.retryHint ||
        (retryAfterSec ? `Live replies should resume in about ${Math.max(1, Math.ceil(retryAfterSec))}s.` : "Stable replies are active while live sync finishes."),
      provider: provider || "local",
      statusCode: Number(value?.statusCode || 0) || undefined,
    };
  }
  if (code === "auth" || code === "env" || code === "invalid_model") {
    return {
      code,
      title: value?.title || "AI provider configuration issue",
      detail:
        value?.detail ||
        `The backend AI provider settings are invalid for live generation.${providerHint}`.trim(),
      retryable: value?.retryable ?? false,
      retryAfterSec: null,
      retryHint: value?.retryHint || "A backend configuration fix is required.",
      provider,
      statusCode: Number(value?.statusCode || 0) || undefined,
    };
  }
  if (["dns", "network", "firewall"].includes(code)) {
    return {
      code,
      title: value?.title || "Live connection is recovering",
      detail: value?.detail || `ZORVIX is waiting for the live model connection to stabilize.${providerHint}`.trim(),
      retryable: value?.retryable ?? true,
      retryAfterSec,
      retryHint: value?.retryHint || "Stable replies are active while live sync finishes.",
      provider,
      statusCode: Number(value?.statusCode || 0) || undefined,
    };
  }
  if (code === "upstream" || code === "upstream_unclassified" || code.startsWith("upstream_") || code === "llm_unavailable") {
    return {
      code,
      title: value?.title || "Live model is syncing",
      detail: value?.detail || `ZORVIX is using the stable response path while the live model catches up.${providerHint}`.trim(),
      retryable: value?.retryable ?? true,
      retryAfterSec,
      retryHint: value?.retryHint || "Stable replies are active while live sync finishes.",
      provider,
      statusCode: Number(value?.statusCode || 0) || undefined,
    };
  }
  return {
    code,
    title: value?.title || "Live model is syncing",
    detail: value?.detail || `ZORVIX is staying in stable mode while the live model recovers.${providerHint}`.trim(),
    retryable: value?.retryable ?? true,
    retryAfterSec,
    retryHint: value?.retryHint || "Stable replies are active while live sync finishes.",
    provider,
    statusCode: Number(value?.statusCode || 0) || undefined,
  };
};

const llmErrorFromApiDetails = (details: unknown): LlmErrorState | null => {
  if (!details || typeof details !== "object") return null;
  const candidate =
    "response" in details && details.response && typeof details.response === "object"
      ? (details.response as Record<string, unknown>)
      : (details as Record<string, unknown>);

  const direct = normalizeLlmErrorState((candidate.llmError as Partial<LlmErrorState> | undefined) || null);
  if (direct) return direct;

  const code = String(candidate.code || "");
  if (!code) return null;

  return normalizeLlmErrorState({
    code,
    title: typeof candidate.error === "string" ? candidate.error : undefined,
    detail: typeof candidate.message === "string" ? candidate.message : undefined,
    retryAfterSec: Number(candidate.retryAfterSec || 0) || null,
  });
};

const llmErrorFromException = (error: unknown): LlmErrorState => {
  if (error && typeof error === "object" && "llmError" in error) {
    const direct = normalizeLlmErrorState((error as { llmError?: Partial<LlmErrorState> }).llmError);
    if (direct) return direct;
  }
  if (error instanceof ApiError) {
    const fromDetails = llmErrorFromApiDetails(error.details);
    if (fromDetails) return fromDetails;
    return (
      normalizeLlmErrorState({ code: error.code, statusCode: error.status, retryAfterSec: error.retryAfterSec || null }) ||
      normalizeLlmErrorState({ code: "llm_unavailable" }) || {
        code: "llm_unavailable",
        title: "Provider unavailable",
        detail: "The AI provider is temporarily unavailable.",
        retryable: true,
        retryHint: "Retry in a moment.",
      }
    );
  }
  return normalizeLlmErrorState({ code: "network" }) || {
    code: "network",
    title: "Provider network issue",
    detail: "The backend could not reach the AI provider.",
    retryable: true,
    retryHint: "Retry in a moment.",
  };
};

const fallbackFromApiError = (error: ApiError) => {
  const details = error.details;
  if (!details || typeof details !== "object") return null;
  const candidate =
    "response" in details && details.response && typeof details.response === "object"
      ? (details.response as Record<string, unknown>)
      : (details as Record<string, unknown>);
  const fallbackText = typeof candidate.fallback === "string" ? candidate.fallback.trim() : "";
  if (!fallbackText) return null;
  const llmError =
    normalizeLlmErrorState((candidate.llmError as Partial<LlmErrorState> | undefined) || null) || null;
  return { text: fallbackText, llmError };
};

const statusHintFromLlmError = (error: LlmErrorState | null) => {
  if (!error) return "Response ready.";
  if (error.code === "timeout" || error.code === "service_busy" || error.code === "rate_limit") {
    return error.retryHint || "Retry in a moment.";
  }
  return error.retryHint || error.detail || error.title;
};

const renderFailureDetail = (error: LlmErrorState) => {
  if (error.code === "timeout" || error.code === "service_busy" || error.code === "rate_limit") {
    return error.retryHint || "Retry in a moment.";
  }
  return error.detail;
};

const renderInlineText = (value: string) =>
  value.split(/(`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={`code-${index}`} className="rounded bg-cyan-400/10 px-1.5 py-0.5 text-[0.92em] text-cyan-100">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={`text-${index}`}>{part}</span>;
  });

const getAssistantToneClass = (raw: string) => {
  const text = String(raw || "").trim();
  if (!text) return "text-[15px] leading-7 text-[var(--theme-text)]";
  if (text.length < 90) return "text-[15.5px] font-medium leading-7 tracking-[0.01em] text-[var(--theme-text)]";
  if (/^(next action|risk|validation|summary|verdict|debrief)\b/i.test(text)) {
    return "text-[15px] font-medium leading-7 text-[var(--theme-text)]";
  }
  if (text.includes("```")) return "text-[14px] leading-7 text-[var(--theme-text)]";
  return "text-[15px] leading-7 text-[var(--theme-text)]";
};

const renderMarkdownLite = (raw: string): ReactNode => {
  const parts = String(raw || "").split("```");
  const nodes: ReactNode[] = [];

  const renderTextChunk = (chunk: string, keyPrefix: string) => {
    const lines = chunk.split("\n");
    const local: ReactNode[] = [];
    let index = 0;

    while (index < lines.length) {
      const rawLine = lines[index].trimEnd();
      const line = rawLine.trim();
      if (!line) {
        index += 1;
        continue;
      }

      if (line.startsWith("### ")) {
        local.push(
          <h4 key={`${keyPrefix}-h4-${index}`} className="text-sm font-semibold tracking-[0.01em] text-cyan-50">
            {renderInlineText(line.slice(4))}
          </h4>
        );
        index += 1;
        continue;
      }

      if (line.startsWith("## ")) {
        local.push(
          <h3 key={`${keyPrefix}-h3-${index}`} className="text-base font-semibold tracking-tight text-white">
            {renderInlineText(line.slice(3))}
          </h3>
        );
        index += 1;
        continue;
      }

      if (line.startsWith("# ")) {
        local.push(
          <h2 key={`${keyPrefix}-h2-${index}`} className="text-lg font-semibold tracking-tight text-white">
            {renderInlineText(line.slice(2))}
          </h2>
        );
        index += 1;
        continue;
      }

      if (line.startsWith("- ")) {
        const items: string[] = [];
        while (index < lines.length && lines[index].trimStart().startsWith("- ")) {
          items.push(lines[index].trimStart().slice(2));
          index += 1;
        }
        local.push(
          <ul key={`${keyPrefix}-ul-${index}`} className="space-y-2.5 pl-5 text-[15px] leading-7 text-slate-200">
            {items.map((item, itemIndex) => (
              <li key={`${keyPrefix}-li-${itemIndex}`} className="list-disc">
                {renderInlineText(item)}
              </li>
            ))}
          </ul>
        );
        continue;
      }

      const paragraph: string[] = [rawLine.trim()];
      index += 1;
      while (index < lines.length && lines[index].trim() && !/^(#{1,3}\s|- )/.test(lines[index].trimStart())) {
        paragraph.push(lines[index].trim());
        index += 1;
      }
      local.push(
        <p key={`${keyPrefix}-p-${index}`} className={getAssistantToneClass(paragraph.join(" "))}>
          {renderInlineText(paragraph.join(" "))}
        </p>
      );
    }

    return local;
  };

  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      nodes.push(
        <pre
          key={`pre-${index}`}
          className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-xs leading-6 text-slate-100"
        >
          <code>{part.trim()}</code>
        </pre>
      );
      return;
    }
    nodes.push(...renderTextChunk(part, `chunk-${index}`));
  });

  return nodes;
};

const TelemetryBar = ({ telemetry, compact = false }: { telemetry: RuntimeTelemetry; compact?: boolean }) => {
  if (compact) {
    const trackShort = {
      RECON: "RECON",
      APPSEC: "APP",
      BINARY_PWN: "PWN",
      REV_ENG: "REV",
    };
    return (
      <div className="mt-1.5 flex items-center gap-1 overflow-hidden">
        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/16 bg-cyan-500/6 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-cyan-100/85">
          <span className="h-1 w-1 rounded-full bg-cyan-400" />
          {telemetry.roadmapDay ? `D${telemetry.roadmapDay}` : "Sess"}
        </span>
        <span className="inline-flex items-center rounded-full border border-white/6 bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-slate-300/60">
          {trackShort[telemetry.vectorTrack] || telemetry.vectorTrack}
        </span>
        <span className="inline-flex items-center rounded-full border border-white/6 bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-slate-300/60">
          {telemetry.difficulty.replace("_", " ")}
        </span>
        {telemetry.sessionXpReward > 0 ? (
          <span className="inline-flex items-center rounded-full border border-emerald-400/14 bg-emerald-500/8 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-emerald-100/85">
            +{telemetry.sessionXpReward} XP
          </span>
        ) : null}
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: telemetry.zorvixThemeHex }}
          aria-hidden="true"
        />
      </div>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-500/8 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-cyan-100/80">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
        {telemetry.roadmapDay ? `Day ${telemetry.roadmapDay}` : "Session"}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-300/85">
        {vectorTrackLabel(telemetry.vectorTrack)}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-300/85">
        {telemetry.difficulty.replace("_", " ")}
      </span>
      {telemetry.sessionXpReward > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/18 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-100/80">
          +{telemetry.sessionXpReward} XP
        </span>
      ) : null}
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: telemetry.zorvixThemeHex }}
        aria-hidden="true"
      />
    </div>
  );
};

const TypingBubble = () => (
  <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/15 bg-[var(--theme-surface)] px-4 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.22)] fadeInUp">
    {[0, 1, 2].map((dot) => (
      <span
        key={dot}
        className="h-2 w-2 animate-bounce rounded-full bg-[var(--theme-accent-blue)]"
        style={{ animationDelay: `${dot * 0.12}s`, animationDuration: "0.9s" }}
      />
    ))}                    <span className="text-xs font-medium text-[var(--theme-text-dim)]">{ZORVIX_NAME} is analyzing your question against mission context...</span>
  </div>
);

interface ZorvixProps {
  /** Render as a full-screen page (no overlay, no portal, no launcher button) */
  fullScreen?: boolean;
}

const Zorvix = ({ fullScreen = false }: ZorvixProps) => {
  const { authState, isAuthenticated } = useAuth();
  const { nextMissionHook, recommendations } = useMissionSystem();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<NeuroMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeTopic, setActiveTopic] = useState<NeuroTopicEvent | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [isUtilityMenuOpen, setIsUtilityMenuOpen] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPreparingAttachment, setIsPreparingAttachment] = useState(false);
  const [statusHint, setStatusHint] = useState("ZORVIX Mentor ready. Share your current challenge or ask for guidance.");
  const [backendHealth, setBackendHealth] = useState<ChatbotHealthResponse | null>(null);
  const [attachment, setAttachment] = useState<ChatAttachmentPayload | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentPreview | null>(null);
  const [lastFailure, setLastFailure] = useState<RetryState | null>(null);
  const [suggestionCycle, setSuggestionCycle] = useState(0);
  const [showSessionBanner, setShowSessionBanner] = useState(false);
  const [isSessionBannerHiding, setIsSessionBannerHiding] = useState(false);
  const [previewText, setPreviewText] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string>("");
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [assistantMode, setAssistantMode] = useState<"normal" | "cyber">("normal");
  const [assistantProfile, setAssistantProfile] = useState<AssistantProfile>(DEFAULT_PROFILE);
  const [, setMemorySummary] = useState<{
    snapshot?: { preferences?: { assistantProfile?: AssistantProfile } };
    stats?: Record<string, number>;
  } | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const hasLocalToken = Boolean(getStoredAccessToken());
  const canUseSyncedSession = isAuthenticated || hasLocalToken;
  const authStillLoading = authState === "loading";

  const deferredPrompt = useDeferredValue(input);
  const deferredSuggestions = useDeferredValue(suggestions);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const currentStreamIdRef = useRef("");
  const currentAssistantIdRef = useRef("");
  const queuedDeltaRef = useRef("");
  const flushFrameRef = useRef<number | null>(null);
  const stickToBottomRef = useRef(true);
  const runAssistantRef = useRef<
    (prompt?: string, topicOverride?: NeuroTopicContext | null, attachmentOverride?: ChatAttachmentPayload | null) => Promise<void>
  >(async () => {});
  const sessionBannerTimerRef = useRef<number | null>(null);
  const attachmentPreviewUrlRef = useRef<string | null>(null);

  const visibleMessages = useMemo(
    () => messages.filter((message, index) => !(index === 0 && message.role === "assistant" && WELCOME_PATTERN.test(message.content))),
    [messages]
  );
  const hasConversationStarted = visibleMessages.length > 0;
  const latestAssistantText = useMemo(() => getLatestAssistantText(visibleMessages), [visibleMessages]);
  const activeTelemetry = useMemo(() => parseTelemetryFromResponse(latestAssistantText), [latestAssistantText]);
  const missionStarterSuggestions = useMemo(
    () =>
      [
        nextMissionHook?.title
          ? `Guide me through ${nextMissionHook.title} with next action, risk, and validation.`
          : "",
        Array.isArray(recommendations) && recommendations[0]?.action
          ? `Convert this recommendation into a tactical checklist: ${recommendations[0].action}`
          : "",
        "Assess my current cyber momentum and tell me the most important move today.",
        "Think like a senior analyst and debrief my current blind spots.",
      ].filter(Boolean),
    [nextMissionHook?.title, recommendations]
  );

  const statusTone = useMemo(() => {
    if (isStreaming) return "Streaming";
    if (!online) return "Offline";
    if (backendHealth?.status === "down") return "Degraded";
    if (backendHealth?.status === "degraded" && !backendHealth?.fallback_ready) return "Degraded";
    return "Ready";
  }, [backendHealth?.fallback_ready, backendHealth?.status, isStreaming, online]);

  const sessionBannerLabel = useMemo(() => {
    if (!online) return "Offline mode ready";
    if (backendHealth?.mode === "fallback_active") return "Stable mode active";
    if (backendHealth?.mode === "local_fallback") return "Local stable mode active";
    if (backendHealth?.status === "degraded") return "Stable replies active";
    return "Connection stable - chat ready";
  }, [backendHealth?.mode, backendHealth?.status, online]);

  const buildProfileForMode = useCallback(
    (mode: "normal" | "cyber"): AssistantProfile => {
      if (mode === "cyber") {
        return {
          ...DEFAULT_PROFILE,
          tone: "professional",
          style: "deep-dive",
          audience: "security_analyst",
        };
      }
      return {
        ...DEFAULT_PROFILE,
        tone: "friendly",
        style: "balanced",
        audience: "general",
      };
    },
    []
  );

  const applyAssistantMode = useCallback(
    async (mode: "normal" | "cyber") => {
      const nextProfile = buildProfileForMode(mode);
      setAssistantMode(mode);
      setAssistantProfile(nextProfile);
      if (!canUseSyncedSession) return;
      try {
        await api.post("/api/neurobot/preferences", { assistantProfile: nextProfile });
      } catch {
        // ignore preference save failures
      }
    },
    [buildProfileForMode, canUseSyncedSession]
  );

  const refreshMemorySummary = useCallback(async () => {
    if (!canUseSyncedSession) {
      setMemorySummary(null);
      return;
    }
    setMemoryLoading(true);
    try {
      const response = await api.get<{
        snapshot?: { preferences?: { assistantProfile?: AssistantProfile } };
        stats?: Record<string, number>;
      }>("/api/neurobot/memory/summary");
      const payload = response.data;
      setMemorySummary(payload);
      const prefProfile = payload?.snapshot?.preferences?.assistantProfile as AssistantProfile | undefined;
      if (prefProfile) {
        setAssistantProfile({ ...DEFAULT_PROFILE, ...prefProfile });
        const isCyber = prefProfile.style === "deep-dive" || prefProfile.tone === "professional";
        setAssistantMode(isCyber ? "cyber" : "normal");
      }
    } catch {
      setMemorySummary(null);
    } finally {
      setMemoryLoading(false);
    }
  }, [canUseSyncedSession]);

  const clearSessionBannerTimer = useCallback(() => {
    if (sessionBannerTimerRef.current !== null) {
      window.clearTimeout(sessionBannerTimerRef.current);
      sessionBannerTimerRef.current = null;
    }
  }, []);

  const showFreshSessionBanner = useCallback(
    (hint = "ZORVIX is ready.") => {
      clearSessionBannerTimer();
      setIsSessionBannerHiding(false);
      setShowSessionBanner(true);
      setStatusHint(hint);
    },
    [clearSessionBannerTimer]
  );

  const hideFreshSessionBanner = useCallback(
    (immediate = false) => {
      if (!showSessionBanner && !isSessionBannerHiding) return;
      clearSessionBannerTimer();
      if (immediate) {
        setIsSessionBannerHiding(false);
        setShowSessionBanner(false);
        return;
      }
      setIsSessionBannerHiding(true);
      sessionBannerTimerRef.current = window.setTimeout(() => {
        setIsSessionBannerHiding(false);
        setShowSessionBanner(false);
        sessionBannerTimerRef.current = null;
      }, 240);
    },
    [clearSessionBannerTimer, isSessionBannerHiding, showSessionBanner]
  );

  const clearAttachmentPreview = useCallback(() => {
    if (attachmentPreviewUrlRef.current) {
      URL.revokeObjectURL(attachmentPreviewUrlRef.current);
      attachmentPreviewUrlRef.current = null;
    }
    setAttachmentPreview(null);
  }, []);

  const resetAttachment = useCallback(
    (hint = "") => {
      clearAttachmentPreview();
      setAttachment(null);
      if (hint) setStatusHint(hint);
    },
    [clearAttachmentPreview]
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const replaceAssistantMessage = useCallback(
    (assistantId: string, content: string) => {
      startTransition(() => {
        setMessages((current) =>
          current.map((message) => (message.id === assistantId ? { ...message, content } : message))
        );
      });
      if (stickToBottomRef.current) scrollToBottom();
    },
    [scrollToBottom]
  );

  const flushAssistantBuffer = useCallback(() => {
    if (flushFrameRef.current !== null) {
      window.cancelAnimationFrame(flushFrameRef.current);
      flushFrameRef.current = null;
    }

    const chunk = queuedDeltaRef.current;
    const assistantId = currentAssistantIdRef.current;
    queuedDeltaRef.current = "";
    if (!chunk || !assistantId) return;

    startTransition(() => {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? { ...message, content: `${message.content}${chunk}` } : message
        )
      );
    });
    if (stickToBottomRef.current) scrollToBottom();
  }, [scrollToBottom]);

  const queueAssistantDelta = useCallback(
    (delta: string) => {
      queuedDeltaRef.current += delta;
      if (flushFrameRef.current !== null) return;

      flushFrameRef.current = window.requestAnimationFrame(() => {
        flushFrameRef.current = null;
        flushAssistantBuffer();
      });
    },
    [flushAssistantBuffer]
  );

  const syncBackendHealth = useCallback(async () => {
    try {
      const healthResponse = await api.get<ChatbotHealthResponse>("/api/health/chatbot");
      const payload = healthResponse.data as ChatbotHealthResponse | null;
      if (payload) {
        setBackendHealth({
          ...payload,
          status: payload.status || "ok",
        });
        return;
      }
      setBackendHealth({ status: "ok" });
    } catch {
      setBackendHealth({ status: "down" });
    }
  }, []);

  const loadSession = useCallback(async () => {
    setIsLoadingSession(true);
    await syncBackendHealth();
    if (authStillLoading) {
      setStatusHint("ZORVIX session sync ho rahi hai...");
      setIsLoadingSession(false);
      return;
    }
    if (!canUseSyncedSession) {
      setMessages([]);
      setActiveTopic(null);
      setStatusHint("Sign in to sync your ZORVIX session.");
      showFreshSessionBanner("ZORVIX is ready.");
      setIsLoadingSession(false);
      window.setTimeout(() => scrollToBottom("auto"), 0);
      return;
    }
    setStatusHint("Preparing the ZORVIX workspace...");
    try {
      const sessionResponse = await api.get<SessionResponse>("/api/neurobot/session");
      const payload = sessionResponse.data;
      const nextMessages = normalizeMessages(payload.messages || []);
      setMessages(nextMessages);
      setActiveTopic(payload.activeTopic ?? null);
      setLastFailure(null);
      if (!nextMessages.some((message, index) => !(index === 0 && message.role === "assistant" && WELCOME_PATTERN.test(message.content)))) {
        showFreshSessionBanner("ZORVIX is ready.");
      } else {
        hideFreshSessionBanner(true);
        setStatusHint("Workspace ready.");
      }
    } catch {
      setMessages([]);
      setActiveTopic(null);
      setInput("");
      setLastFailure(null);
      resetAttachment();
      showFreshSessionBanner("ZORVIX is ready.");
      setStatusHint("Workspace ready. Your next prompt will initialize a fresh session.");
    } finally {
      setIsLoadingSession(false);
      window.setTimeout(() => scrollToBottom("auto"), 0);
    }
  }, [authStillLoading, canUseSyncedSession, hideFreshSessionBanner, resetAttachment, scrollToBottom, showFreshSessionBanner, syncBackendHealth]);

  const abortStream = useCallback(
    (hint = "Generation stopped.") => {
      streamAbortRef.current?.abort();
      const streamId = currentStreamIdRef.current;
      if (streamId) {
        api.post("/api/neurobot/chat/stream/abort", { streamId }).catch(() => undefined);
      }
      flushAssistantBuffer();
      currentStreamIdRef.current = "";
      streamAbortRef.current = null;
      currentAssistantIdRef.current = "";
      setIsStreaming(false);
      setStatusHint(hint);
    },
    [flushAssistantBuffer]
  );

  const recoverWithSync = useCallback(
    async ({
      prompt,
      assistantId,
      attachmentPayload,
      topic,
    }: {
      prompt: string;
      assistantId: string;
      attachmentPayload: ChatAttachmentPayload | null;
      topic: NeuroTopicContext | null;
    }) => {
      try {
        let payload: SessionResponse | null = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const chatResponse = await api.post<SessionResponse>("/api/neurobot/chat", {
              message: prompt,
              assistantProfile: assistantProfile || DEFAULT_PROFILE,
              attachments: attachmentPayload ? [attachmentPayload] : [],              });
            payload = chatResponse.data;
            break;
          } catch (error) {
            const retryable = !(error instanceof ApiError) || error.status === 429 || error.status >= 500;
            if (!retryable || attempt === 1) throw error;
            setStatusHint("Primary response path failed. Retrying once through the stable channel...");
            await delay(700);
          }
        }

        if (!payload) throw new Error("chat_recovery_failed");
        const nextMessages = normalizeMessages(payload.messages || []);
        startTransition(() => setMessages(nextMessages));
        setActiveTopic(payload.activeTopic ?? topic ?? null);
        const llmError = payload.fallback ? normalizeLlmErrorState(payload.llmError) : null;
        setStatusHint(payload.fallback ? statusHintFromLlmError(llmError) : "Response ready.");
        const assistantText = getLatestAssistantText(nextMessages);
        return {
          assistantText: assistantText || STREAM_ERROR_TEXT,
          llmError,
        };
      } catch (error) {
        setBackendHealth({ status: "degraded", llm_ready: false });
        const apiFallback = error instanceof ApiError ? fallbackFromApiError(error) : null;
        const llmError = apiFallback?.llmError || llmErrorFromException(error);

        // Last-resort: use the local mentor engine for context-aware fallback
        const localResponse = generateLocalMentorResponse(prompt, {
          topic: topic?.title || undefined,
          missionTitle: topic?.title || undefined,
          skillLevel: "intermediate",
        });
        const fallbackText =
          apiFallback?.text ||
          (error instanceof ApiError && error.status === 429 ? error.message : localResponse.text);
        replaceAssistantMessage(assistantId, fallbackText);
        setStatusHint("ZORVIX Core: Uplink unstable. Local guidance active.");
        return {
          assistantText: fallbackText,
          llmError,
        };
      }
    },
    [assistantProfile, replaceAssistantMessage]
  );

  const streamPrompt = useCallback(
    async ({
      prompt,
      attachmentPayload,
    }: {
      prompt: string;
      attachmentPayload: ChatAttachmentPayload | null;
    }) => {
      const controller = new AbortController();
      streamAbortRef.current = controller;
      currentStreamIdRef.current = "";
      let llmError: LlmErrorState | null = null;

      const response = await apiFetch("/api/neurobot/chat/stream", {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: prompt,
          assistantProfile: assistantProfile || DEFAULT_PROFILE,
          attachments: attachmentPayload ? [attachmentPayload] : [],
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("stream_start_failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        while (buffer.includes("\n\n")) {
          const boundary = buffer.indexOf("\n\n");
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (!block.trim()) continue;

          const parsed = parseSseBlock(block);
          const payload = safeParseJson(parsed.data);

          if (parsed.event === "open") {
            currentStreamIdRef.current = String(payload.streamId || "");
            continue;
          }

          if (parsed.event === "warning") {
            llmError =
              normalizeLlmErrorState((payload.llmError as Partial<LlmErrorState> | undefined) || null) ||
              normalizeLlmErrorState({ code: String(payload.errorCode || "llm_unavailable") });
            continue;
          }

          if (parsed.event === "token") {
            const delta = String(payload.token || "");
            if (!delta) continue;
            assistantText += delta;
            queueAssistantDelta(delta);
            continue;
          }

          if (parsed.event === "error") {
            const streamError = new Error(String(payload.message || payload.code || "stream_failed")) as Error & {
              llmError?: LlmErrorState | null;
            };
            streamError.llmError =
              normalizeLlmErrorState((payload.llmError as Partial<LlmErrorState> | undefined) || null) ||
              normalizeLlmErrorState({ code: String(payload.code || "stream_failed") });
            throw streamError;
          }

          if (parsed.event === "done") {
            if (String(payload.status || "") === "error") {
              const streamError = new Error(String(payload.code || "stream_failed")) as Error & {
                llmError?: LlmErrorState | null;
              };
              streamError.llmError =
                normalizeLlmErrorState((payload.llmError as Partial<LlmErrorState> | undefined) || null) ||
                normalizeLlmErrorState({ code: String(payload.code || "stream_failed") });
              throw streamError;
            }
            if (payload.degraded || String(payload.status || "") === "fallback") {
              llmError =
                normalizeLlmErrorState((payload.llmError as Partial<LlmErrorState> | undefined) || null) ||
                normalizeLlmErrorState({ code: String(payload.errorCode || "llm_unavailable") });
            }
          }
        }
      }

      flushAssistantBuffer();
      return {
        assistantText: assistantText.trim(),
        llmError,
      };
    },
    [assistantProfile, flushAssistantBuffer, queueAssistantDelta]
  );

  // ── Fast Groq direct path (bypasses neurobot stream for quick queries) ──
  const queryZorvixDirect = useCallback(
    async ({ prompt, assistantId }: { prompt: string; assistantId: string }) => {
      const controller = new AbortController();
      streamAbortRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), GROQ_DIRECT_TIMEOUT_MS);

      try {
        const response = await apiFetch("/api/ai/zorvix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: prompt }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const error = new Error(String(errorBody.message || "groq_direct_failed")) as Error & {
            llmError?: LlmErrorState | null;
          };
          if (response.status === 429) {
            error.llmError = normalizeLlmErrorState({ code: "rate_limit", retryAfterSec: 30 });
          }
          throw error;
        }

        const data = (await response.json()) as { reply?: string; timestamp?: string };
        const reply = String(data.reply || "").trim();
        if (!reply) throw new Error("empty_groq_response");

        replaceAssistantMessage(assistantId, reply);
        setStatusHint("Fast reply ready (Groq).");
        return { assistantText: reply, llmError: null as LlmErrorState | null };
      } finally {
        window.clearTimeout(timeout);
        // Note: streamAbortRef and currentAssistantIdRef cleanup is handled by runAssistant.finally
        // Do NOT clear them here — the stream fallback path needs them intact.
      }
    },
    [replaceAssistantMessage]
  );

  const runAssistant = useCallback(
    async (
      promptOverride?: string,
      topicOverride?: NeuroTopicContext | null,
      attachmentOverride?: ChatAttachmentPayload | null
    ) => {
      const composerAttachment = attachmentOverride ?? attachment;
      const prompt = String(promptOverride ?? input).trim() || (composerAttachment ? DEFAULT_ATTACHMENT_PROMPT : "");
      if (!prompt || isStreaming || isPreparingAttachment) return;

      const assistantId = `assistant-${Date.now() + 1}`;
      const attachmentPayload = composerAttachment;
      const topic = topicOverride ?? activeTopic;
      currentAssistantIdRef.current = assistantId;
      queuedDeltaRef.current = "";
      hideFreshSessionBanner();
      setLastFailure(null);

      startTransition(() => {
        setMessages((current) => [...current, createMessage("user", prompt), createMessage("assistant", "", assistantId)]);
      });
      setInput("");
      resetAttachment();
      setIsSuggestionOpen(false);
      setIsUtilityMenuOpen(false);
      setIsStreaming(true);

      setStatusHint(`${ZORVIX_NAME} is deciphering...`);
      scrollToBottom();

      let result = { assistantText: "", llmError: null as LlmErrorState | null };

      // ── Step 0: Direct Groq API from frontend (no auth, no backend required) ──
      if (!attachmentPayload && isQuickQuery(prompt, null)) {
        setStatusHint(`${ZORVIX_NAME} routing through direct Groq channel...`);
        try {
          const groqDirect = await queryGroqDirect(prompt, {
            topic: topic?.title,
          });
          if (groqDirect.source === "live") {
            result = {
              assistantText: groqDirect.reply,
              llmError: null,
            };
            replaceAssistantMessage(assistantId, groqDirect.reply);
            setStatusHint("Fast reply ready (Groq direct).");
          } else {
            // Fallback response from direct path — still use it
            result = {
              assistantText: groqDirect.reply,
              llmError: { code: "local_fallback", title: "Local guidance active", detail: groqDirect.error || "" },
            };
            replaceAssistantMessage(assistantId, groqDirect.reply);
            setStatusHint("Zorvix Core: Uplink interrupted. Local guidance active.");
          }
        } catch {
          // Direct Groq failed — fall through to backend paths
          replaceAssistantMessage(assistantId, "");
          queuedDeltaRef.current = "";
        }
      }

      // ── Step 1: If no result yet, try the existing backend paths ──
      if (!result.assistantText.trim()) {
        if (!canUseSyncedSession) {
          // No auth available and direct Groq failed — use local mentor immediately
          const localResp = generateLocalMentorResponse(prompt, {
            topic: topic?.title || undefined,
            missionTitle: topic?.title || undefined,
            skillLevel: "intermediate",
          });
          result = {
            assistantText: localResp.text,
            llmError: { code: "local_fallback", title: "Local guidance active", detail: "No backend or direct API available." },
          };
          replaceAssistantMessage(assistantId, localResp.text);
          setStatusHint("Zorvix Core: Uplink interrupted. Local guidance active.");
        } else {
          // Authenticated — try the backend paths
          const useFastPath = isQuickQuery(prompt, attachmentPayload);
          if (useFastPath) {
            try {
              const fastResult = await queryZorvixDirect({ prompt, assistantId });
              if (fastResult.assistantText.trim()) {
                result = fastResult;
                setStatusHint("Fast reply ready (Groq).");
              }
            } catch {
              replaceAssistantMessage(assistantId, "");
              queuedDeltaRef.current = "";
            }
          }

          if (!result.assistantText.trim()) {
            try {
              const streamResult = await streamPrompt({ prompt, attachmentPayload });
              if (streamResult.assistantText.trim()) {
                result = streamResult;
                setStatusHint(streamResult.llmError ? statusHintFromLlmError(streamResult.llmError) : "Live answer ready.");
              }
            } catch {
              result = await recoverWithSync({ prompt, assistantId, attachmentPayload, topic });
            }
          }
        }
      }

      flushAssistantBuffer();
      currentAssistantIdRef.current = "";
      currentStreamIdRef.current = "";
      streamAbortRef.current = null;
      setIsStreaming(false);

      if (result.llmError) {
        setLastFailure({
          prompt,
          topic,
          attachmentPayload,
          error: result.llmError,
        });
      }
      setSuggestionCycle((current) => current + 1);
      await syncBackendHealth();
    },
    [
      activeTopic,
      attachment,
      canUseSyncedSession,
      flushAssistantBuffer,
      hideFreshSessionBanner,
      input,
      isPreparingAttachment,
      isStreaming,
      queryGroqDirect,
      queryZorvixDirect,
      recoverWithSync,
      replaceAssistantMessage,
      resetAttachment,
      scrollToBottom,
      streamPrompt,
      syncBackendHealth,
    ]
  );

  const runPreview = useCallback(async () => {
    const composerAttachment = attachment;
    const prompt = String(input).trim() || (composerAttachment ? DEFAULT_ATTACHMENT_PROMPT : "");
    if (!prompt || isStreaming || isPreparingAttachment) return;
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewText("");
    try {
      const previewResponse = await api.post<{ response?: string }>("/api/neurobot/preview", {
        message: prompt,
        assistantProfile: assistantProfile || DEFAULT_PROFILE,
        attachments: composerAttachment ? [composerAttachment] : [],
        topic: activeTopic
          ? {
              id: activeTopic.id,
              title: activeTopic.title,
              query: activeTopic.query || "",
              tags: activeTopic.tags || [],
              roadmapDay: activeTopic.roadmapDay,
            }
          : null,
      });
      setPreviewText(String(previewResponse.data?.response || "").trim());
    } catch (error) {
      const detail = error instanceof ApiError ? error.message : "Preview failed.";
      setPreviewError(detail);
    } finally {
      setPreviewLoading(false);
    }
  }, [activeTopic, assistantProfile, attachment, input, isPreparingAttachment, isStreaming]);

  useEffect(() => {
    runAssistantRef.current = async (
      prompt?: string,
      topicOverride?: NeuroTopicContext | null,
      attachmentOverride?: ChatAttachmentPayload | null
    ) => runAssistant(prompt, topicOverride, attachmentOverride);
  }, [runAssistant]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void refreshMemorySummary();
  }, [isOpen, refreshMemorySummary]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const handleScroll = () => {
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
      stickToBottomRef.current = distance < 120;
    };

    node.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => node.removeEventListener("scroll", handleScroll);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    startTransition(() => {
      setSuggestions(
        buildSuggestions({
          prompt: deferredPrompt,
          answer: hasConversationStarted ? latestAssistantText : "",
          topic: activeTopic,
          attachmentName: attachment?.filename || "",
          cycle: suggestionCycle,
        })
      );
    });
  }, [activeTopic, attachment?.filename, deferredPrompt, hasConversationStarted, isOpen, latestAssistantText, suggestionCycle]);

  useEffect(() => {
    const field = textareaRef.current;
    if (!field) return;
    field.style.height = "0px";
    const maxHeight = window.innerWidth < 640 ? 128 : 164;
    const minHeight = window.innerWidth < 640 ? 46 : 52;
    field.style.height = `${Math.min(Math.max(field.scrollHeight, minHeight), maxHeight)}px`;
  }, [input]);

  useEffect(() => {
    if (!hasConversationStarted || !showSessionBanner || isSessionBannerHiding) return;
    hideFreshSessionBanner(true);
  }, [hasConversationStarted, hideFreshSessionBanner, isSessionBannerHiding, showSessionBanner]);

  useEffect(() => {
    if (!isOpen) return;
    if (!messages.length) void loadSession();

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      abortStream("Generation stopped and workspace closed.");
      setIsOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [abortStream, isOpen, loadSession, messages.length]);

  // ── Global keyboard shortcut: Ctrl+/ (or Cmd+/) toggles the overlay ──
  useEffect(() => {
    if (fullScreen) return;

    const handleToggleShortcut = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();

      if (isOpen) {
        abortStream("Workspace closed via shortcut.");
        setIsOpen(false);
      } else {
        window.dispatchEvent(new Event("neurobot:open"));
      }
    };

    window.addEventListener("keydown", handleToggleShortcut);
    return () => window.removeEventListener("keydown", handleToggleShortcut);
  }, [abortStream, fullScreen, isOpen]);

  useEffect(() => {
    const handler = () => {
      setIsOpen(true);
      setStatusHint("ZORVIX workspace ready.");
      if (!messages.length) void loadSession();
      window.setTimeout(() => textareaRef.current?.focus(), 60);
    };

    window.addEventListener("neurobot:open", handler as EventListener);
    return () => window.removeEventListener("neurobot:open", handler as EventListener);
  }, [loadSession, messages.length]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<NeuroTopicEvent>;
      const topic = normalizeTopicPayload((custom as CustomEvent<NeuroTopicEvent>)?.detail);
      if (!topic) {
        setStatusHint("Topic saved locally. Add a clearer title or prompt to sync it.");
        return;
      }
      const nextPrompt = String(topic?.query || "").trim();
      const shouldAutoSubmit = topic?.autoSubmit ?? Boolean(nextPrompt);

      setIsOpen(true);
      setActiveTopic(topic);
      setInput(nextPrompt);
      setStatusHint(topic?.mentorMode ? `Mentor mode ready: ${topic.title}` : `Topic ready: ${topic.title}`);
      hideFreshSessionBanner();
      setSuggestionCycle((current) => current + 1);

      if (canUseSyncedSession) {
        api.post<SessionResponse>("/api/neurobot/topic", { topic })
          .then((topicResponse) => {
            const topicPayload = topicResponse.data;
            setMessages(normalizeMessages(topicPayload.messages || []));
            setActiveTopic(topicPayload.activeTopic ?? topic);
          })
          .catch(() => {
            setStatusHint("Topic synced locally. Server sync will retry on the next message.");
          });
      } else {
        setStatusHint("Topic ready locally. Sign in to sync it across sessions.");
      }

      window.setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(nextPrompt.length, nextPrompt.length);
      }, 80);

      if (shouldAutoSubmit && nextPrompt) {
        window.setTimeout(() => {
          runAssistantRef.current(nextPrompt, topic).catch(() => undefined);
        }, 140);
      }
    };

    window.addEventListener("neurobot:topic", handler as EventListener);
    return () => window.removeEventListener("neurobot:topic", handler as EventListener);
  }, [canUseSyncedSession, hideFreshSessionBanner]);

  useEffect(() => {
    return () => {
      clearSessionBannerTimer();
      clearAttachmentPreview();
      streamAbortRef.current?.abort();
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current);
      }
    };
  }, [clearAttachmentPreview, clearSessionBannerTimer]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAssistant();
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void runAssistant();
  };

  const handleAttachmentPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    hideFreshSessionBanner();

    if (!isSupportedAttachment(file)) {
      toast({
        title: "Unsupported attachment",
        description: "Use a text file, PDF, or common image format.",
      });
      return;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast({
        title: "Attachment too large",
        description: "Use a file under 2 MB so the chat stays responsive.",
      });
      return;
    }

    try {
      setIsPreparingAttachment(true);
      clearAttachmentPreview();
      const kind = getAttachmentKind(file);
      const [base64, snippet] = await Promise.all([
        readFileAsBase64(file),
        kind === "text"
          ? file
            .slice(0, 1024)
            .text()
            .then((value) => compactWhitespace(value).slice(0, 180))
            .catch(() => "")
          : Promise.resolve(""),
      ]);

      const previewUrl = kind === "image" ? URL.createObjectURL(file) : "";
      if (previewUrl) attachmentPreviewUrlRef.current = previewUrl;

      setAttachment({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        base64,
      });
      setAttachmentPreview({
        kind,
        previewUrl: previewUrl || undefined,
        snippet: snippet || undefined,
        extension: getFileExtension(file.name) || undefined,
      });
      setSuggestionCycle((current) => current + 1);
      setStatusHint(`${file.name} is attached and ready.`);
    } catch {
      toast({
        title: "Attachment failed",
        description: "The file could not be read in this browser session.",
      });
    } finally {
      setIsPreparingAttachment(false);
    }
  };

  const handleNewChat = async () => {
    if (isStreaming) abortStream("Generation stopped. Starting a fresh chat.");
    if (!canUseSyncedSession) {
      setMessages([]);
      setActiveTopic(null);
      setInput("");
      setLastFailure(null);
      resetAttachment();
      setSuggestionCycle((current) => current + 1);
      setIsSuggestionOpen(false);
      setIsUtilityMenuOpen(false);
      showFreshSessionBanner("ZORVIX is ready.");
      setStatusHint("Sign in karo to chat history sync aur reset ho sake.");
      scrollToBottom("auto");
      return;
    }
    try {
      const clearResponse = await api.post<SessionResponse>("/api/neurobot/history/clear", { scope: "session" });
      const clearPayload = clearResponse.data;
      setMessages(normalizeMessages(clearPayload.messages || []));
      setActiveTopic(null);
      setInput("");
      setLastFailure(null);
      resetAttachment();
      setSuggestionCycle((current) => current + 1);
      setIsSuggestionOpen(false);
      setIsUtilityMenuOpen(false);
      showFreshSessionBanner("ZORVIX is ready.");
      scrollToBottom("auto");
    } catch {
      setStatusHint("Session abhi clear nahi ho paya. Ek sec baad retry karo.");
    }
  };

  const retryLastFailure = useCallback(async () => {
    if (!lastFailure || isStreaming || isPreparingAttachment) return;
    await runAssistant(lastFailure.prompt, lastFailure.topic, lastFailure.attachmentPayload);
  }, [isPreparingAttachment, isStreaming, lastFailure, runAssistant]);

  // ── Full-screen mode: auto-load session on mount ──
  useEffect(() => {
    if (fullScreen && !messages.length) void loadSession();
  }, [fullScreen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Full-screen mode: render chat shell directly (no portal, no overlay, no launcher) ──
  if (fullScreen) {
    const chatShell = (
      <section className="mx-auto flex h-full w-full max-w-[1240px] flex-col p-2 sm:p-4">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[var(--theme-border)] text-[var(--theme-text)] sm:rounded-[30px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(14,165,233,0.06),transparent_24%),linear-gradient(180deg,transparent,rgba(4,10,18,0.18)_40%,rgba(2,5,10,0.28))]"
          />
          <header className="relative z-10 flex items-center justify-between gap-3 border-b border-[var(--theme-border)] bg-[var(--theme-bg)]/96 px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)]">
                <Bot className="h-4 w-4" />
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${!online ? "bg-slate-500" : backendHealth?.status && backendHealth.status !== "ok" ? "bg-amber-500" : "bg-[#00ff88]"}`} />
                <span className="text-sm font-semibold text-[var(--theme-text)]">{ZORVIX_NAME}</span>
                <span className="text-[10px] font-medium text-cyan-400/70 font-mono hidden sm:inline">{MENTOR_LABEL}</span>
                {activeTopic ? (
                  <span className="max-w-[42vw] truncate rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--theme-text-muted)] sm:max-w-[240px]">
                    {activeTopic.title}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${!online ? "bg-slate-500" : backendHealth?.status === "down" ? "bg-red-500" : "bg-emerald-500"}`} />
              <span className="text-xs text-[var(--theme-text-muted)]">{statusTone}</span>
            </div>
          </header>

          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col">
              {isLoadingSession && !visibleMessages.length ? (
                <div className="mx-auto flex min-h-full w-full max-w-[880px] items-center justify-center py-10">
                  <div className="inline-flex items-center gap-3 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-3 text-sm font-medium text-[var(--theme-text)]">
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                    ZORVIX session loading
                  </div>
                </div>
              ) : !visibleMessages.length ? (
                <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col justify-center gap-4 py-4 sm:gap-5">
                  <div className="space-y-2 px-1">
                    <h3 className="text-xl font-semibold tracking-tight text-[var(--theme-text)] sm:text-2xl">
                      {ZORVIX_NAME}
                      <span className="ml-2 text-sm font-normal text-cyan-400/80 font-mono">{MENTOR_LABEL}</span>
                    </h3>
                    <p className="max-w-[52ch] text-sm leading-6 text-[var(--theme-text-muted)]">
                      {MENTOR_TAGLINE}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {(missionStarterSuggestions.length ? missionStarterSuggestions : DEFAULT_SUGGESTIONS).slice(0, 4).map((suggestion) => (
                      <button key={suggestion} type="button" onClick={() => void runAssistant(suggestion)} className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-3 text-left text-sm font-medium text-[var(--theme-text)] transition hover:border-[var(--theme-accent-blue)]/30 hover:bg-[var(--theme-overlay-hover)]">
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-[840px] flex-col gap-3 sm:gap-4">
                  {visibleMessages.map((message) => {
                    const isAssistant = message.role === "assistant";
                    const isPendingAssistant = isAssistant && isStreaming && !message.content.trim();
                    return (
                      <article key={message.id} className={`flex w-full ${isAssistant ? "justify-start" : "justify-end"}`}>
                        <div className={`min-w-0 max-w-[92%] rounded-[22px] px-4 py-3 text-[15px] leading-7 text-[var(--theme-text)] sm:max-w-[78%] sm:px-5 ${isAssistant ? "border-l-[3px] border-[#00ff88] bg-[var(--theme-surface)]" : "bg-[var(--theme-card)]"}`}>
                          {isPendingAssistant ? (
                            <HackerSpinner />
                          ) : (
                            <div className={`space-y-3 ${isAssistant ? "zorvix-assistant-copy" : "zorvix-user-copy"}`}>
                              {isAssistant ? renderMarkdownLite(stripTelemetryBlock(message.content)) : <p className="whitespace-pre-wrap">{message.content}</p>}
                              {isAssistant && activeTelemetry && message.id === visibleMessages[visibleMessages.length - 1]?.id && (
                                <TelemetryBar telemetry={activeTelemetry} />
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Composer — reused in both modes */}
            <div className="border-t border-[var(--theme-border)] bg-[var(--theme-bg)]/98 px-2.5 py-2.5 backdrop-blur sm:px-4 sm:py-3">
              <div className="mx-auto flex w-full max-w-[840px] flex-col gap-2">
                {lastFailure?.error ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-amber-500/20 bg-amber-950/30 px-3 py-2.5 text-xs text-amber-100 sm:text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{lastFailure.error.title}</p>
                      <p className="mt-1 text-amber-100/80">{renderFailureDetail(lastFailure.error)}</p>
                    </div>
                    {lastFailure.error.retryable ? (
                      <button type="button" onClick={() => void retryLastFailure()} disabled={isStreaming || isLoadingSession || isPreparingAttachment} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-amber-600/30 px-3 text-xs font-medium text-amber-100 transition disabled:cursor-not-allowed disabled:opacity-60">
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Retry
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1 rounded-[24px] border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2">
                      {attachment ? (
                        <div className="mb-2.5 rounded-[18px] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-2.5">
                          <div className="flex items-start gap-3">
                            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--theme-overlay)] text-[var(--theme-text-muted)] shadow-sm">
                              <FileText className="h-5 w-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="truncate text-sm font-medium text-[var(--theme-text)]">{attachment.filename}</span>
                              <p className="mt-1 text-xs leading-5 text-[var(--theme-text-dim)]">{formatBytes(attachment.size)} ready</p>
                            </div>
                            <button type="button" onClick={() => resetAttachment("Attachment removed.")} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--theme-text-dim)] transition hover:text-[var(--theme-text)]" aria-label="Remove attachment">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <textarea ref={textareaRef} rows={1} value={input} onChange={(event) => { hideFreshSessionBanner(); setInput(event.target.value); }} onFocus={() => hideFreshSessionBanner()} onKeyDown={handleComposerKeyDown} placeholder="Ask a question, share a problem, or request the next step." className="min-h-[44px] w-full resize-none border-0 bg-transparent px-0.5 py-1 text-[15px] leading-6 text-[var(--theme-text)] outline-none placeholder:text-[var(--theme-text-dim)] sm:min-h-[48px]" aria-label={`Message ${ZORVIX_NAME}`} />
                    </div>
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isPreparingAttachment} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] transition hover:border-[var(--theme-accent-blue)]/30 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Attach file">
                      {isPreparingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                    </button>
                    <button type="submit" disabled={(!input.trim() && !attachment) || isStreaming || isLoadingSession || isPreparingAttachment} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--theme-accent-green)] text-[var(--theme-bg)] transition hover:shadow-[0_0_0_1px_rgba(0,255,136,0.18),0_14px_32px_rgba(0,255,136,0.18)] disabled:cursor-not-allowed disabled:opacity-50">
                      {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-end px-1 text-[11px] text-[var(--theme-text-dim)]">
                    <span className="max-w-full truncate">{statusTone}{statusHint ? ` \u2022 ${statusHint}` : ""}</span>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    );

    return (
      <>
        {chatShell}
        <input ref={fileInputRef} type="file" accept={ATTACHMENT_ACCEPT} className="hidden" onChange={handleAttachmentPick} />
      </>
    );
  }

  // ── Non-fullscreen mode: floating overlay panel ──
  if (!isOpen) return null;

  return (
    <>
      <div
        data-testid="zorvix-overlay-backdrop"
        className="fixed inset-0 z-[1399] bg-black/40 backdrop-blur-sm"
        onClick={() => { abortStream("Workspace closed."); setIsOpen(false); }}
        aria-hidden="true"
      />
      <section
        className="fixed bottom-0 right-0 z-[1400] flex h-[85vh] w-full max-w-[520px] flex-col rounded-t-[28px] border border-[var(--theme-border)] text-[var(--theme-text)] shadow-2xl sm:bottom-4 sm:right-4 sm:rounded-[28px]"
        style={{ backgroundColor: "var(--theme-bg)" }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_28%),linear-gradient(180deg,transparent,rgba(4,10,18,0.12)_40%,rgba(2,5,10,0.22))]"
        />
        <header className="relative z-10 flex items-center justify-between gap-3 border-b border-[var(--theme-border)] bg-[var(--theme-bg)]/96 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)]">
              <Bot className="h-4 w-4" />
            </span>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${!online ? "bg-slate-500" : backendHealth?.status && backendHealth.status !== "ok" ? "bg-amber-500" : "bg-[#00ff88]"}`} />
            <span className="text-sm font-semibold text-[var(--theme-text)]">{ZORVIX_NAME}</span>
            <span className="text-[10px] font-medium text-cyan-400/70 font-mono hidden sm:inline">{MENTOR_LABEL}</span>
            {activeTopic ? (
              <span className="max-w-[200px] truncate rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2.5 py-1 text-[10px] font-medium text-[var(--theme-text-muted)]">
                {activeTopic.title}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => { abortStream("Workspace closed."); setIsOpen(false); }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-muted)] transition hover:text-[var(--theme-text)]"
            aria-label="Close ZORVIX"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {isLoadingSession && !visibleMessages.length ? (
              <div className="mx-auto flex min-h-full w-full items-center justify-center py-10">
                <div className="inline-flex items-center gap-3 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-3 text-sm font-medium text-[var(--theme-text)]">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                  Loading...
                </div>
              </div>
            ) : !visibleMessages.length ? (
              <div className="mx-auto flex min-h-full w-full max-w-[420px] flex-col justify-center gap-4 px-4 py-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight text-[var(--theme-text)]">
                    {ZORVIX_NAME}
                    <span className="ml-2 text-xs font-normal text-cyan-400/80 font-mono">{MENTOR_LABEL}</span>
                  </h3>
                  <p className="text-sm leading-6 text-[var(--theme-text-muted)] max-w-[42ch]">
                    {MENTOR_TAGLINE}
                  </p>
                </div>
                <div className="grid gap-2">
                  {(missionStarterSuggestions.length ? missionStarterSuggestions : DEFAULT_SUGGESTIONS).slice(0, 3).map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => void runAssistant(suggestion)} className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2.5 text-left text-sm font-medium text-[var(--theme-text)] transition hover:border-[var(--theme-accent-blue)]/30">
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-[460px] flex-col gap-3 px-4 py-4">
                {visibleMessages.map((message) => {
                  const isAssistant = message.role === "assistant";
                  const isPendingAssistant = isAssistant && isStreaming && !message.content.trim();
                  return (
                    <article key={message.id} className={`flex w-full ${isAssistant ? "justify-start" : "justify-end"}`}>
                      <div className={`min-w-0 max-w-[92%] rounded-[20px] px-3.5 py-2.5 text-[14px] leading-6 text-[var(--theme-text)] sm:max-w-[82%] ${isAssistant ? "border-l-[3px] border-[#00ff88] bg-[var(--theme-surface)]" : "bg-[var(--theme-card)]"}`}>
                        {isPendingAssistant ? (
                          <HackerSpinner />
                        ) : (
                          <div className="space-y-2">
                            {isAssistant ? renderMarkdownLite(stripTelemetryBlock(message.content)) : <p className="whitespace-pre-wrap text-[14px]">{message.content}</p>}
                            {isAssistant && activeTelemetry && message.id === visibleMessages[visibleMessages.length - 1]?.id && (
                              <TelemetryBar telemetry={activeTelemetry} compact />
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="border-t border-[var(--theme-border)] bg-[var(--theme-bg)]/98 px-3 py-2.5 backdrop-blur">
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1 rounded-[22px] border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2">
                  <textarea ref={textareaRef} rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder="Ask anything..." className="min-h-[40px] w-full resize-none border-0 bg-transparent text-[14px] leading-5 text-[var(--theme-text)] outline-none placeholder:text-[var(--theme-text-dim)]" aria-label={`Message ${ZORVIX_NAME}`} />
                </div>
                <button type="submit" disabled={(!input.trim() && !attachment) || isStreaming || isLoadingSession} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--theme-accent-green)] text-[var(--theme-bg)] transition hover:shadow-[0_0_0_1px_rgba(0,255,136,0.18),0_14px_32px_rgba(0,255,136,0.18)] disabled:cursor-not-allowed disabled:opacity-50">
                  {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex items-center justify-end px-1 text-[10px] text-[var(--theme-text-dim)]">
                <span className="max-w-full truncate">{statusTone}{statusHint ? ` \u2022 ${statusHint}` : ""}</span>
              </div>
            </form>
          </div>
        </div>
      </section>
      <input ref={fileInputRef} type="file" accept={ATTACHMENT_ACCEPT} className="hidden" onChange={handleAttachmentPick} />
    </>
  );
};

export default Zorvix;


