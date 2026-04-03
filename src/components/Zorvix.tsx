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
  Menu,
  Paperclip,
  RefreshCcw,
  Send,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "@/hooks/use-toast";
import { ApiError, apiFetch, apiGetJson, apiPostJson, getStoredAccessToken } from "@/lib/apiClient";
import { NeuroMessage, NeuroTopicContext } from "@/lib/neurobotEngine";
import { useAuth } from "@/context/AuthContext";
import { useMissionSystem } from "@/context/MissionSystemApiContext";

const ZORVIX_NAME = "ZORVIX";
const MAX_ATTACHMENT_BYTES = 2_000_000;
const DEFAULT_ATTACHMENT_PROMPT = "Analyze this attachment from a cybersecurity perspective.";
const WELCOME_PATTERN = /^##\s*zorvi/i;
const STREAM_ERROR_TEXT = "The live stream was interrupted. ZORVIX kept the workspace stable, but please retry for a complete answer.";
const SERVICE_UNAVAILABLE_TEXT =
  "ZORVIX could not reach the AI service right now. Your message was received, but the response path is temporarily unavailable. Please retry in a moment.";
const DEFAULT_SUGGESTIONS = [
  "Tell me the highest-value next cyber mission and why it matters.",
  "Debrief my current security learning state and expose my blind spots.",
  "Turn this security problem into next action, risk, and validation.",
  "Build a focused recon or defense practice sprint for today.",
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
}

const normalizeTopicPayload = (topic: Partial<NeuroTopicEvent> | null | undefined): NeuroTopicEvent | null => {
  if (!topic || typeof topic !== "object") return null;
  const rawTitle = String(topic.title || "").trim();
  const rawQuery = String(topic.query || "").trim();
  const tags = Array.isArray(topic.tags)
    ? topic.tags.map((tag) => String(tag || "").trim()).filter(Boolean).slice(0, 20)
    : [];
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
  if (!text) return "text-[15px] leading-7 text-[#e2e8f0]";
  if (text.length < 90) return "text-[15.5px] font-medium leading-7 tracking-[0.01em] text-[#e2e8f0]";
  if (/^(next action|risk|validation|summary|verdict|debrief)\b/i.test(text)) {
    return "text-[15px] font-medium leading-7 text-[#f8fafc]";
  }
  if (text.includes("```")) return "text-[14px] leading-7 text-[#e2e8f0]";
  return "text-[15px] leading-7 text-[#e2e8f0]";
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

const TypingBubble = () => (
  <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/15 bg-[#0b0f17] px-4 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.22)] fadeInUp">
    {[0, 1, 2].map((dot) => (
      <span
        key={dot}
        className="h-2 w-2 animate-bounce rounded-full bg-[#2f81ff]"
        style={{ animationDelay: `${dot * 0.12}s`, animationDuration: "0.9s" }}
      />
    ))}
    <span className="text-xs font-medium text-slate-400">{ZORVIX_NAME} soch raha hai...</span>
  </div>
);

const Zorvix = () => {
  const { authState, isAuthenticated } = useAuth();
  const { nextMissionHook, recommendations } = useMissionSystem();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<NeuroMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeTopic, setActiveTopic] = useState<NeuroTopicContext | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [isUtilityMenuOpen, setIsUtilityMenuOpen] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPreparingAttachment, setIsPreparingAttachment] = useState(false);
  const [statusHint, setStatusHint] = useState("Open ZORVIX aur next smart move lo.");
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
  const missionStarterSuggestions = useMemo(
    () =>
      [
        nextMissionHook.title
          ? `Guide me through ${nextMissionHook.title} with next action, risk, and validation.`
          : "",
        recommendations[0]?.action ? `Convert this recommendation into a tactical checklist: ${recommendations[0].action}` : "",
        "Assess my current cyber momentum and tell me the most important move today.",
        "Think like a senior analyst and debrief my current blind spots.",
      ].filter(Boolean),
    [nextMissionHook.title, recommendations]
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
        await apiPostJson("/api/neurobot/preferences", { assistantProfile: nextProfile });
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
      const payload = await apiGetJson<{
        snapshot?: { preferences?: { assistantProfile?: AssistantProfile } };
        stats?: Record<string, number>;
      }>("/api/neurobot/memory/summary");
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
      const response = await apiFetch("/api/health/chatbot");
      const payload = (await response.json().catch(() => null)) as ChatbotHealthResponse | null;
      if (payload) {
        setBackendHealth({
          ...payload,
          status: payload.status || (response.ok ? "ok" : "down"),
        });
        return;
      }
      setBackendHealth({ status: response.ok ? "ok" : "down" });
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
      const response = await apiFetch("/api/neurobot/session");
      if (!response.ok) throw new Error("session_load_failed");
      const payload = (await response.json()) as SessionResponse;
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
        apiFetch("/api/neurobot/chat/stream/abort", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ streamId }),
        }).catch(() => undefined);
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
            payload = await apiPostJson<SessionResponse>("/api/neurobot/chat", {
              message: prompt,
              assistantProfile: assistantProfile || DEFAULT_PROFILE,
              attachments: attachmentPayload ? [attachmentPayload] : [],
            });
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
        const fallbackText =
          apiFallback?.text ||
          (error instanceof ApiError && error.status === 429 ? error.message : SERVICE_UNAVAILABLE_TEXT);
        replaceAssistantMessage(assistantId, fallbackText);
        setStatusHint(statusHintFromLlmError(llmError));
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

  const runAssistant = useCallback(
    async (
      promptOverride?: string,
      topicOverride?: NeuroTopicContext | null,
      attachmentOverride?: ChatAttachmentPayload | null
    ) => {
      const composerAttachment = attachmentOverride ?? attachment;
      const prompt = String(promptOverride ?? input).trim() || (composerAttachment ? DEFAULT_ATTACHMENT_PROMPT : "");
      if (!prompt || isStreaming || isPreparingAttachment) return;
      if (!canUseSyncedSession) {
        setStatusHint("Sign in to start a ZORVIX session.");
        toast({
          title: "Sign in required",
          description: "ZORVIX session sync is available after authentication.",
        });
        return;
      }

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
      setStatusHint(`${ZORVIX_NAME} is reasoning across tools and knowledge modules...`);
      scrollToBottom();

      let result = { assistantText: "", llmError: null as LlmErrorState | null };
      try {
        result = await streamPrompt({ prompt, attachmentPayload });
        if (!result.assistantText.trim()) throw new Error("empty_stream");
        setStatusHint(result.llmError ? statusHintFromLlmError(result.llmError) : "Live answer ready.");
      } catch {
        result = await recoverWithSync({ prompt, assistantId, attachmentPayload, topic });
      } finally {
        flushAssistantBuffer();
        currentAssistantIdRef.current = "";
        currentStreamIdRef.current = "";
        streamAbortRef.current = null;
        setIsStreaming(false);
      }

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
      recoverWithSync,
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
      const payload = await apiPostJson<{ response?: string }>("/api/neurobot/preview", {
        message: prompt,
        assistantProfile: assistantProfile || DEFAULT_PROFILE,
        attachments: composerAttachment ? [composerAttachment] : [],
        topic: activeTopic
          ? {
              id: activeTopic.id,
              title: activeTopic.title,
              query: activeTopic.query || "",
              tags: activeTopic.tags || [],
            }
          : null,
      });
      setPreviewText(String(payload?.response || "").trim());
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
      const topic = normalizeTopicPayload(custom.detail);
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
        apiPostJson<SessionResponse>("/api/neurobot/topic", { topic })
          .then((payload) => {
            setMessages(normalizeMessages(payload.messages || []));
            setActiveTopic(payload.activeTopic ?? topic);
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
      const payload = await apiPostJson<SessionResponse>("/api/neurobot/history/clear", { scope: "session" });
      setMessages(normalizeMessages(payload.messages || []));
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

  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <>
      <div
        className="zorvix-launcher-root"
        style={{ position: "fixed", right: "1rem", bottom: "1rem", zIndex: 1400, opacity: 1, visibility: "visible", pointerEvents: "auto" }}
      >
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            if (!messages.length) void loadSession();
          }}
          className="zorvix-button zorvix-launcher group inline-flex items-center gap-3 rounded-full px-3 py-3 text-left text-slate-100 backdrop-blur transition sm:px-4"
          style={{ display: "inline-flex", opacity: 1, visibility: "visible", pointerEvents: "auto" }}
          aria-label={`Open ${ZORVIX_NAME}`}
        >
          <span className="zorvix-launcher-mark flex h-11 w-11 items-center justify-center rounded-full text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="hidden min-w-0 sm:block">
            <strong className="block text-sm font-semibold tracking-tight text-white">ZORVIX AI</strong>
            <span className="block text-xs text-slate-400">{nextMissionHook.title || "ZeroDay Guardian control panel"}</span>
          </span>
        </button>
      </div>

      {isOpen ? (
        <div
          className="zorvix-overlay fixed inset-0 bg-[#05070c]/90 backdrop-blur-md"
          style={{ zIndex: 1450, opacity: 1, visibility: "visible", pointerEvents: "auto", display: "block" }}
        >
          <section className="zorvix-shell-root mx-auto flex h-[100dvh] w-full max-w-[1240px] flex-col p-2 sm:p-4">
            <div className="zorvix-surface relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[#202638] text-[#e2e8f0] sm:rounded-[30px]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(14,165,233,0.06),transparent_24%),linear-gradient(180deg,transparent,rgba(4,10,18,0.18)_40%,rgba(2,5,10,0.28))]"
              />

              <header className="relative z-10 flex items-center justify-between gap-3 border-b border-[#1f2634] bg-[#0a0a0f]/96 px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="zorvix-header-mark flex h-10 w-10 items-center justify-center rounded-full border border-[#233043] bg-[#0d1117] text-[#e2e8f0]">
                    <Bot className="h-4 w-4" />
                  </span>
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        !online ? "bg-slate-500" : backendHealth?.status && backendHealth.status !== "ok" ? "bg-amber-500" : "bg-[#00ff88]"
                      }`}
                    />
                    {activeTopic ? (
                      <span className="max-w-[42vw] truncate rounded-full border border-[#233043] bg-[#0d1117] px-2.5 py-1 text-[11px] font-medium text-[#94a3b8] sm:max-w-[240px]">
                        {activeTopic.title}
                      </span>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (isStreaming) abortStream("Generation stopped and workspace closed.");
                    setIsOpen(false);
                  }}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#233043] bg-[#0d1117] text-[#94a3b8] transition hover:border-[#2d3b52] hover:text-white"
                  aria-label="Close ZORVIX"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                <div className="flex min-h-0 flex-1 flex-col">
                  {showSessionBanner ? (
                    <div
                      className={`zorvix-session-banner border-b border-[#202638] bg-[#0d1117] px-3 py-2 backdrop-blur sm:px-6 ${
                        isSessionBannerHiding ? "is-hiding" : ""
                      }`}
                      role="status"
                    >
                      <div className="mx-auto flex w-full max-w-[900px] items-center gap-3">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                            !online ? "bg-slate-400" : backendHealth?.status && backendHealth.status !== "ok" ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                        />
                        <p className="min-w-0 truncate text-sm font-medium tracking-[0.01em] text-slate-200">{sessionBannerLabel}</p>
                      </div>
                    </div>
                  ) : null}

                  <div ref={scrollRef} className="zorvix-chat-scroll min-h-0 flex-1 overflow-y-auto px-2.5 py-3 sm:px-4 sm:py-4">
                    {isLoadingSession && !visibleMessages.length ? (
                      <div className="mx-auto flex min-h-full w-full max-w-[880px] items-center justify-center py-10">
                          <div className="zorvix-soft-panel inline-flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium text-[#e2e8f0]">
                          <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                          ZORVIX session loading
                        </div>
                      </div>
                    ) : !visibleMessages.length ? (
                      <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col justify-center gap-4 py-4 sm:gap-5">
                        <div className="space-y-2 px-1">
                          <h3 className="text-xl font-semibold tracking-tight text-[#e2e8f0] sm:text-2xl">Ask ZORVIX</h3>
                          <p className="max-w-[46ch] text-sm leading-6 text-[#94a3b8]">
                            Clear guidance, next actions, and focused cyber answers without noise.
                          </p>
                        </div>
                        <div className="grid gap-2">
                          {(missionStarterSuggestions.length ? missionStarterSuggestions : DEFAULT_SUGGESTIONS).slice(0, 4).map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => void runAssistant(suggestion)}
                              className="rounded-2xl border border-[#233043] bg-[#0d1117] px-4 py-3 text-left text-sm font-medium text-[#e2e8f0] transition hover:border-[#2c3b51] hover:bg-[#111722]"
                            >
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
                            <article
                              key={message.id}
                              className={`flex w-full ${isAssistant ? "justify-start" : "justify-end"}`}
                            >
                              <div
                                className={`min-w-0 max-w-[92%] rounded-[22px] px-4 py-3 text-[15px] leading-7 text-[#e2e8f0] sm:max-w-[78%] sm:px-5 ${
                                  isAssistant
                                    ? "border-l-[3px] border-[#00ff88] bg-[#0d1117]"
                                    : "bg-[#1a1a2e]"
                                }`}
                              >
                                {isPendingAssistant ? (
                                  <TypingBubble />
                                ) : (
                                  <div className={`space-y-3 ${isAssistant ? "zorvix-assistant-copy" : "zorvix-user-copy"}`}>
                                    {isAssistant ? renderMarkdownLite(message.content) : <p className="whitespace-pre-wrap">{message.content}</p>}
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

                  <div className="zorvix-composer-bar border-t border-[#1f2634] bg-[#0a0a0f]/98 px-2.5 py-2.5 backdrop-blur sm:px-4 sm:py-3">
                    <div className="mx-auto flex w-full max-w-[840px] flex-col gap-2">
                      {lastFailure?.error ? (
                        <div className="zorvix-warning-panel flex flex-wrap items-center justify-between gap-3 rounded-[18px] px-3 py-2.5 text-xs text-amber-100 sm:text-sm">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{lastFailure.error.title}</p>
                            <p className="mt-1 text-amber-100/80">{renderFailureDetail(lastFailure.error)}</p>
                          </div>
                          {lastFailure.error.retryable ? (
                            <button
                              type="button"
                              onClick={() => void retryLastFailure()}
                              disabled={isStreaming || isLoadingSession || isPreparingAttachment}
                              className="zorvix-warning-btn inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-xs font-medium text-amber-100 transition disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <RefreshCcw className="h-3.5 w-3.5" />
                              Retry
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {previewText || previewError ? (
                        <div className="zorvix-soft-card rounded-[18px] px-3 py-2.5 text-xs text-[#e2e8f0] sm:text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-[#e2e8f0]">Preview answer</p>
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewText("");
                                setPreviewError("");
                              }}
                               className="zorvix-neutral-btn rounded-full px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:text-white"
                            >
                              Clear
                            </button>
                          </div>
                          {previewError ? <p className="mt-2 text-rose-300">{previewError}</p> : null}
                          {previewText ? (
                            <div className="mt-2 space-y-2 text-[#e2e8f0]">
                              {renderMarkdownLite(previewText)}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {isUtilityMenuOpen ? (
                        <div className="zorvix-utility-menu rounded-[18px] border border-[#233043] bg-[#0d1117] p-2">
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <button
                              type="button"
                              onClick={() => {
                                setIsUtilityMenuOpen(false);
                                void handleNewChat();
                              }}
                              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#131a26] px-3 text-sm font-medium text-[#e2e8f0] transition hover:bg-[#182132]"
                            >
                              <RefreshCcw className="h-4 w-4" />
                              New
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsUtilityMenuOpen(false);
                                hideFreshSessionBanner();
                                void runPreview();
                              }}
                              disabled={(!input.trim() && !attachment) || isStreaming || isLoadingSession || isPreparingAttachment || previewLoading}
                              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#131a26] px-3 text-sm font-medium text-[#e2e8f0] transition hover:bg-[#182132] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsUtilityMenuOpen(false);
                                setIsSuggestionOpen((current) => !current);
                              }}
                              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#131a26] px-3 text-sm font-medium text-[#e2e8f0] transition hover:bg-[#182132]"
                            >
                              <Sparkles className="h-4 w-4" />
                              Prompts
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsUtilityMenuOpen(false);
                                void applyAssistantMode(assistantMode === "cyber" ? "normal" : "cyber");
                              }}
                              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#131a26] px-3 text-sm font-medium text-[#e2e8f0] transition hover:bg-[#182132]"
                            >
                              <Bot className="h-4 w-4" />
                              {assistantMode === "cyber" ? "Guide" : "Expert"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsUtilityMenuOpen(false);
                                void refreshMemorySummary();
                              }}
                              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#131a26] px-3 text-sm font-medium text-[#e2e8f0] transition hover:bg-[#182132]"
                            >
                              {memoryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                              Memory
                            </button>
                            {isStreaming ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsUtilityMenuOpen(false);
                                  abortStream("Generation stopped.");
                                }}
                                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#2a1616] px-3 text-sm font-medium text-amber-100 transition hover:bg-[#351d1d]"
                              >
                                <Square className="h-4 w-4 fill-current" />
                                Stop
                              </button>
                            ) : null}
                          </div>
                          {isSuggestionOpen ? (
                            <div className="mt-2 grid gap-2">
                              {deferredSuggestions.slice(0, 4).map((suggestion) => (
                                <button
                                  key={suggestion}
                                  type="button"
                                  onClick={() => {
                                    setIsUtilityMenuOpen(false);
                                    setIsSuggestionOpen(false);
                                    void runAssistant(suggestion);
                                  }}
                                  className="rounded-2xl border border-[#233043] bg-[#111722] px-3 py-2.5 text-left text-sm font-medium text-[#e2e8f0] transition hover:border-[#2c3b51]"
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                        <div className="zorvix-composer-row-shell flex items-end gap-2">
                          <div className="zorvix-input-shell min-w-0 flex-1 rounded-[24px] border border-[#233043] bg-[#1a1a2e] px-3 py-2">
                            {activeTopic ? (
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#233043] bg-[#0d1117] px-3 py-1 text-[11px] font-medium text-[#94a3b8]">
                                  <span className="truncate">{activeTopic.title}</span>
                                </span>
                              </div>
                            ) : null}

                            {attachment ? (
                              <div className="zorvix-soft-card mb-2.5 rounded-[18px] border border-[#233043] bg-[#0d1117] p-2.5">
                                <div className="flex items-start gap-3">
                                  {attachmentPreview?.kind === "image" && attachmentPreview.previewUrl ? (
                                    <img
                                      src={attachmentPreview.previewUrl}
                                      alt={attachment.filename}
                                      className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-sm"
                                    />
                                  ) : (
                                     <span className="zorvix-file-mark flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-slate-300 shadow-sm">
                                      {attachmentPreview?.kind === "file" ? <Paperclip className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                    </span>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="truncate text-sm font-medium text-[#e2e8f0]">{attachment.filename}</span>
                                       <span className="zorvix-chip-neutral rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                        {attachmentPreview?.extension || attachmentPreview?.kind || "file"}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-slate-400">
                                      {attachmentPreview?.snippet || `${formatBytes(attachment.size)} ready for backend processing.`}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => resetAttachment("Attachment removed.")}
                                     className="zorvix-neutral-btn inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:text-white"
                                    aria-label="Remove attachment"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : null}

                            <textarea
                              ref={textareaRef}
                              rows={1}
                              value={input}
                              onChange={(event) => {
                                hideFreshSessionBanner();
                                setInput(event.target.value);
                              }}
                              onFocus={() => hideFreshSessionBanner()}
                              onKeyDown={handleComposerKeyDown}
                              placeholder="Ask a question, share a problem, or request the next step."
                              className="zorvix-composer-textarea min-h-[44px] w-full resize-none border-0 bg-transparent px-0.5 py-1 text-[15px] leading-6 text-[#e2e8f0] outline-none placeholder:text-[#6c7891] sm:min-h-[48px]"
                              aria-label={`Message ${ZORVIX_NAME}`}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              hideFreshSessionBanner();
                              fileInputRef.current?.click();
                            }}
                            disabled={isPreparingAttachment}
                            className="zorvix-composer-icon-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#233043] bg-[#1a1a2e] text-[#e2e8f0] transition hover:border-[#2c3b51] disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Attach file"
                            title="Attach file"
                          >
                            {isPreparingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                          </button>

                          <button
                            type="submit"
                            disabled={(!input.trim() && !attachment) || isStreaming || isLoadingSession || isPreparingAttachment}
                            className="zorvix-composer-send-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#00ff88] text-[#04110a] transition hover:shadow-[0_0_0_1px_rgba(0,255,136,0.18),0_14px_32px_rgba(0,255,136,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              hideFreshSessionBanner();
                              setIsUtilityMenuOpen((current) => !current);
                            }}
                            className="zorvix-composer-icon-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#233043] bg-[#1a1a2e] text-[#e2e8f0] transition hover:border-[#2c3b51]"
                            title="Open actions"
                          >
                            <Menu className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="zorvix-composer-status flex items-center justify-end px-1 text-[11px] text-[#6f7b93]">
                          <span className="max-w-full truncate">
                            {statusTone}
                            {statusHint ? ` • ${statusHint}` : ""}
                          </span>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <input ref={fileInputRef} type="file" accept={ATTACHMENT_ACCEPT} className="hidden" onChange={handleAttachmentPick} />
    </>,
    portalTarget
  );
};

export default Zorvix;


