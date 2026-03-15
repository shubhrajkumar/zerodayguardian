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
  Lightbulb,
  Loader2,
  Paperclip,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  UserRound,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "@/hooks/use-toast";
import { ApiError, apiFetch, apiPostJson } from "@/lib/apiClient";
import { NeuroMessage, NeuroTopicContext } from "@/lib/neurobotEngine";

const ZORVIX_NAME = "Zorvix";
const MAX_ATTACHMENT_BYTES = 2_000_000;
const DEFAULT_ATTACHMENT_PROMPT = "Analyze this attachment from a cybersecurity perspective.";
const WELCOME_PATTERN = /^##\s*zorvi/i;
const STREAM_ERROR_TEXT = "The live stream was interrupted. I kept the workspace stable, but please retry for a complete answer.";
const SERVICE_UNAVAILABLE_TEXT =
  "Zorvix could not reach the AI service right now. Your message was received, but the response path is temporarily unavailable. Please retry in a moment.";
const DEFAULT_SUGGESTIONS = [
  "Explain the OWASP Top 10 in plain English.",
  "Build a 14-day cybersecurity learning roadmap.",
  "Show a safe phishing triage checklist.",
  "Help me debug a backend 500 error step by step.",
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
  error: LlmErrorState;
}

interface NeuroTopicEvent extends NeuroTopicContext {
  mentorMode?: boolean;
  autoSubmit?: boolean;
}

const DEFAULT_PROFILE: AssistantProfile = {
  tone: "professional",
  style: "balanced",
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
  if (!value && !value?.code) return null;
  const code = String(value?.code || "llm_unavailable").toLowerCase();
  const retryAfterSec = Number(value?.retryAfterSec || 0) || null;
  const provider = String(value?.provider || "");
  const providerHint = provider ? ` Provider: ${provider}.` : "";

  if (code === "timeout") {
    return {
      code,
      title: value?.title || "Provider timeout",
      detail: value?.detail || `The AI provider did not finish generating before the timeout.${providerHint}`.trim(),
      retryable: value?.retryable ?? true,
      retryAfterSec,
      retryHint: value?.retryHint || "Retry in a moment.",
      provider,
      statusCode: Number(value?.statusCode || 0) || undefined,
    };
  }
  if (code === "service_busy") {
    return {
      code,
      title: value?.title || "AI services are temporarily busy",
      detail:
        value?.detail ||
        "AI services are temporarily busy. Please try again shortly.",
      retryable: value?.retryable ?? true,
      retryAfterSec,
      retryHint: value?.retryHint || (retryAfterSec ? `Retry in about ${Math.max(1, Math.ceil(retryAfterSec))}s.` : "Please try again shortly."),
      provider: "",
      statusCode: Number(value?.statusCode || 0) || undefined,
    };
  }
  if (code === "rate_limit") {
    return {
      code,
      title: value?.title || "Provider temporarily unavailable",
      detail:
        value?.detail ||
        `The AI provider is currently throttling requests, so live generation is temporarily limited.${providerHint}`.trim(),
      retryable: value?.retryable ?? true,
      retryAfterSec,
      retryHint: value?.retryHint || (retryAfterSec ? `Retry in about ${Math.max(1, Math.ceil(retryAfterSec))}s.` : "Retry in a moment."),
      provider,
      statusCode: Number(value?.statusCode || 0) || undefined,
    };
  }
  if (code === "circuit_open") {
    return {
      code,
      title: value?.title || "All providers temporarily unavailable",
      detail: value?.detail || `The configured AI providers are in recovery after recent failures.${providerHint}`.trim(),
      retryable: value?.retryable ?? true,
      retryAfterSec,
      retryHint: value?.retryHint || "Retry in a moment while providers recover.",
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
        "Zorvix switched to local fallback mode while the AI provider recovers.",
      retryable: value?.retryable ?? false,
      retryAfterSec,
      retryHint:
        value?.retryHint ||
        (retryAfterSec ? `Live provider retry in about ${Math.max(1, Math.ceil(retryAfterSec))}s.` : "Live provider retry will resume automatically."),
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
      title: value?.title || "Provider network issue",
      detail: value?.detail || `The backend could not reach the AI provider.${providerHint}`.trim(),
      retryable: value?.retryable ?? true,
      retryAfterSec,
      retryHint: value?.retryHint || "Retry in a moment.",
      provider,
      statusCode: Number(value?.statusCode || 0) || undefined,
    };
  }
  if (code === "upstream" || code === "upstream_unclassified" || code.startsWith("upstream_") || code === "llm_unavailable") {
    return {
      code,
      title: value?.title || "Provider temporarily unavailable",
      detail: value?.detail || `The AI provider could not complete this request right now.${providerHint}`.trim(),
      retryable: value?.retryable ?? true,
      retryAfterSec,
      retryHint: value?.retryHint || "Retry in a moment.",
      provider,
      statusCode: Number(value?.statusCode || 0) || undefined,
    };
  }
  return {
    code,
    title: value?.title || "Provider temporarily unavailable",
    detail: value?.detail || `The AI provider could not complete this request right now.${providerHint}`.trim(),
    retryable: value?.retryable ?? true,
    retryAfterSec,
    retryHint: value?.retryHint || "Retry in a moment.",
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
      normalizeLlmErrorState({ code: "llm_unavailable" })
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
  return error.retryHint || error.detail || error.title;
};

const renderInlineText = (value: string) =>
  value.split(/(`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={`code-${index}`} className="rounded bg-slate-900/8 px-1.5 py-0.5 text-[0.92em] text-slate-900">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={`text-${index}`}>{part}</span>;
  });

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
          <h4 key={`${keyPrefix}-h4-${index}`} className="text-sm font-semibold text-slate-950">
            {renderInlineText(line.slice(4))}
          </h4>
        );
        index += 1;
        continue;
      }

      if (line.startsWith("## ")) {
        local.push(
          <h3 key={`${keyPrefix}-h3-${index}`} className="text-base font-semibold text-slate-950">
            {renderInlineText(line.slice(3))}
          </h3>
        );
        index += 1;
        continue;
      }

      if (line.startsWith("# ")) {
        local.push(
          <h2 key={`${keyPrefix}-h2-${index}`} className="text-lg font-semibold text-slate-950">
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
          <ul key={`${keyPrefix}-ul-${index}`} className="space-y-2 pl-5 text-sm leading-6 text-slate-700">
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
        <p key={`${keyPrefix}-p-${index}`} className="text-sm leading-6 text-slate-700">
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
  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
    {[0, 1, 2].map((dot) => (
      <span
        key={dot}
        className="h-2 w-2 animate-bounce rounded-full bg-sky-500"
        style={{ animationDelay: `${dot * 0.12}s`, animationDuration: "0.9s" }}
      />
    ))}
    <span className="text-xs font-medium text-slate-500">{ZORVIX_NAME} is composing a live answer</span>
  </div>
);

const Zorvix = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<NeuroMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeTopic, setActiveTopic] = useState<NeuroTopicContext | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPreparingAttachment, setIsPreparingAttachment] = useState(false);
  const [statusHint, setStatusHint] = useState("Open Zorvix and start a security conversation.");
  const [backendHealth, setBackendHealth] = useState<ChatbotHealthResponse | null>(null);
  const [attachment, setAttachment] = useState<ChatAttachmentPayload | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentPreview | null>(null);
  const [lastFailure, setLastFailure] = useState<RetryState | null>(null);
  const [suggestionCycle, setSuggestionCycle] = useState(0);
  const [showSessionBanner, setShowSessionBanner] = useState(false);
  const [isSessionBannerHiding, setIsSessionBannerHiding] = useState(false);
  const [online, setOnline] = useState<boolean>(navigator.onLine);

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

  const statusTone = useMemo(() => {
    if (isStreaming) return "Streaming";
    if (!online) return "Offline";
    if (backendHealth?.status && backendHealth.status !== "ok") return "Degraded";
    if (backendHealth?.llm_ready === false) return "Degraded";
    return "Ready";
  }, [backendHealth?.llm_ready, backendHealth?.status, isStreaming, online]);

  const sessionBannerLabel = useMemo(() => {
    if (!online) return "Offline mode - Zorvix local workspace ready";
    if (backendHealth?.status && backendHealth.status !== "ok") return "Connection stable - resilient reply mode ready";
    if (backendHealth?.llm_ready === false) return "Connection stable - resilient reply mode ready";
    return "Connection stable - Zorvix chat ready";
  }, [backendHealth?.llm_ready, backendHealth?.status, online]);

  const clearSessionBannerTimer = useCallback(() => {
    if (sessionBannerTimerRef.current !== null) {
      window.clearTimeout(sessionBannerTimerRef.current);
      sessionBannerTimerRef.current = null;
    }
  }, []);

  const showFreshSessionBanner = useCallback(
    (hint = "Fresh Zorvix chat ready.") => {
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
    setStatusHint("Preparing the Zorvix workspace...");
    await syncBackendHealth();
    try {
      const response = await apiFetch("/api/neurobot/session");
      if (!response.ok) throw new Error("session_load_failed");
      const payload = (await response.json()) as SessionResponse;
      const nextMessages = normalizeMessages(payload.messages || []);
      setMessages(nextMessages);
      setActiveTopic(payload.activeTopic ?? null);
      setLastFailure(null);
      if (!nextMessages.some((message, index) => !(index === 0 && message.role === "assistant" && WELCOME_PATTERN.test(message.content)))) {
        showFreshSessionBanner("Fresh Zorvix chat ready.");
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
      showFreshSessionBanner("Fresh Zorvix chat ready.");
      setStatusHint("Workspace ready. Your next prompt will initialize a fresh session.");
    } finally {
      setIsLoadingSession(false);
      window.setTimeout(() => scrollToBottom("auto"), 0);
    }
  }, [hideFreshSessionBanner, resetAttachment, scrollToBottom, showFreshSessionBanner, syncBackendHealth]);

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
              assistantProfile: DEFAULT_PROFILE,
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
    [replaceAssistantMessage]
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
          assistantProfile: DEFAULT_PROFILE,
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
    [flushAssistantBuffer, queueAssistantDelta]
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
      setStatusHint("Zorvix workspace ready.");
      if (!messages.length) void loadSession();
      window.setTimeout(() => textareaRef.current?.focus(), 60);
    };

    window.addEventListener("neurobot:open", handler as EventListener);
    return () => window.removeEventListener("neurobot:open", handler as EventListener);
  }, [loadSession, messages.length]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<NeuroTopicEvent>;
      const topic = custom.detail;
      const nextPrompt = String(topic?.query || "").trim();
      const shouldAutoSubmit = topic?.autoSubmit ?? Boolean(nextPrompt);

      setIsOpen(true);
      setActiveTopic(topic);
      setInput(nextPrompt);
      setStatusHint(topic?.mentorMode ? `Mentor mode ready: ${topic.title}` : `Topic ready: ${topic.title}`);
      hideFreshSessionBanner();
      setSuggestionCycle((current) => current + 1);

      apiPostJson<SessionResponse>("/api/neurobot/topic", { topic })
        .then((payload) => {
          setMessages(normalizeMessages(payload.messages || []));
          setActiveTopic(payload.activeTopic ?? topic);
        })
        .catch(() => {
          setStatusHint("Topic synced locally. Server sync will retry on the next message.");
        });

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
  }, [hideFreshSessionBanner]);

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
    try {
      const payload = await apiPostJson<SessionResponse>("/api/neurobot/history/clear", { scope: "session" });
      setMessages(normalizeMessages(payload.messages || []));
      setActiveTopic(null);
      setInput("");
      setLastFailure(null);
      resetAttachment();
      setSuggestionCycle((current) => current + 1);
      setIsSuggestionOpen(false);
      showFreshSessionBanner("Fresh Zorvix chat ready.");
      scrollToBottom("auto");
    } catch {
      setStatusHint("Could not clear the session right now.");
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
          className="zorvix-button group inline-flex items-center gap-3 rounded-full border border-white/35 bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(226,232,240,0.96))] px-4 py-3 text-left text-slate-900 shadow-[0_14px_36px_rgba(15,23,42,0.24)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.22)]"
          style={{ display: "inline-flex", opacity: 1, visibility: "visible", pointerEvents: "auto" }}
          aria-label={`Open ${ZORVIX_NAME}`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#60a5fa,#0b1220)] text-white shadow-lg">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <strong className="block text-sm font-semibold tracking-tight">{ZORVIX_NAME} AI</strong>
            <span className="block text-xs text-slate-500">Clean live cybersecurity workspace</span>
          </span>
        </button>
      </div>

      {isOpen ? (
        <div
          className="zorvix-overlay fixed inset-0 bg-slate-950/55 backdrop-blur-sm"
          style={{ zIndex: 1450, opacity: 1, visibility: "visible", pointerEvents: "auto", display: "block" }}
        >
          <section className="zorvix-shell-root mx-auto flex h-[100dvh] w-full max-w-[1240px] flex-col p-2 sm:p-4">
            <div className="zorvix-surface relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.96))] text-slate-950 shadow-[0_30px_120px_rgba(15,23,42,0.45)] sm:rounded-[30px]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.2),transparent_36%),radial-gradient(circle_at_85%_15%,rgba(14,165,233,0.14),transparent_28%),linear-gradient(180deg,transparent,rgba(255,255,255,0.72)_40%,rgba(226,232,240,0.56))]"
              />

              <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-3 py-3 sm:px-6 sm:py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.25)] sm:h-11 sm:w-11">
                      <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <h2 className="text-base font-semibold tracking-tight text-slate-950 sm:text-lg">{ZORVIX_NAME} Workspace</h2>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {statusTone}
                        </span>
                        {activeTopic ? (
                          <span className="max-w-full truncate rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
                            {activeTopic.title}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                        Live streaming, resilient replies, and a compact mobile-first workspace.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950 sm:h-10 sm:px-4 sm:text-sm"
                  >
                    <RefreshCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    New chat
                  </button>
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={() => abortStream("Generation stopped.")}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-800 shadow-sm transition hover:bg-amber-100 sm:h-10 sm:px-4 sm:text-sm"
                    >
                      <Square className="h-3.5 w-3.5 fill-current sm:h-4 sm:w-4" />
                      Stop
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (isStreaming) abortStream("Generation stopped and workspace closed.");
                      setIsOpen(false);
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950 sm:h-10 sm:w-10"
                    aria-label="Close Zorvix"
                  >
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                </div>
              </header>

              <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                <div className="flex min-h-0 flex-1 flex-col">
                  {showSessionBanner ? (
                    <div
                      className={`zorvix-session-banner border-b border-slate-200/70 bg-white/92 px-3 py-2 backdrop-blur sm:px-6 ${
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
                        <p className="min-w-0 truncate text-sm font-medium tracking-[0.01em] text-slate-700">{sessionBannerLabel}</p>
                      </div>
                    </div>
                  ) : null}

                  <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6 lg:px-10">
                    {isLoadingSession && !visibleMessages.length ? (
                      <div className="mx-auto flex min-h-full w-full max-w-[880px] items-center justify-center py-10">
                        <div className="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
                          <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                          Syncing your Zorvix session
                        </div>
                      </div>
                    ) : !visibleMessages.length ? (
                      <div className="mx-auto flex min-h-full w-full max-w-[880px] flex-col justify-center gap-6 py-6 sm:gap-8 sm:py-8">
                        <div className="max-w-[720px]">
                          <p className="text-xs font-medium uppercase tracking-[0.24em] text-sky-600 sm:text-sm">Zero Day Guardian AI</p>
                          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:mt-4 sm:text-4xl">
                            Minimal interface. Live answers. Reliable backend flow.
                          </h3>
                          <p className="mt-3 max-w-[62ch] text-sm leading-6 text-slate-600 sm:mt-4 sm:text-base sm:leading-7">
                            Ask Zorvix about secure coding, malware triage, threat research, lab debugging, or defensive
                            workflows. The workspace streams responses progressively and keeps the conversation readable on
                            desktop and mobile.
                          </p>
                        </div>

                        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                          {DEFAULT_SUGGESTIONS.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => void runAssistant(suggestion)}
                              className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-3 text-left shadow-[0_12px_28px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_18px_38px_rgba(56,189,248,0.16)]"
                            >
                              <span className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-white sm:h-10 sm:w-10">
                                <Sparkles className="h-4 w-4" />
                              </span>
                              <span className="block text-sm font-medium text-slate-900">{suggestion}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4 sm:gap-5">
                        {visibleMessages.map((message) => {
                          const isAssistant = message.role === "assistant";
                          const isPendingAssistant = isAssistant && isStreaming && !message.content.trim();

                          return (
                            <article
                              key={message.id}
                              className={`zorvix-message-shell flex w-full gap-2.5 sm:gap-3.5 ${isAssistant ? "items-start" : "items-start justify-end"}`}
                            >
                              {isAssistant ? (
                                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm sm:h-10 sm:w-10">
                                  <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </span>
                              ) : null}

                              <div
                                className={`zorvix-message-bubble min-w-0 max-w-[min(100%,760px)] rounded-[24px] px-3.5 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.12)] sm:rounded-[26px] sm:px-5 sm:py-4 ${
                                  isAssistant
                                    ? "border border-slate-200/80 bg-white"
                                    : "border border-slate-900/10 bg-slate-950 text-white"
                                }`}
                              >
                                <div
                                  className={`mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] sm:text-[11px] ${
                                    isAssistant ? "text-slate-400" : "text-sky-200"
                                  }`}
                                >
                                  {isAssistant ? <Bot className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                                  {isAssistant ? ZORVIX_NAME : "You"}
                                </div>

                                {isPendingAssistant ? (
                                  <TypingBubble />
                                ) : (
                                  <div className={`space-y-3 ${isAssistant ? "" : "text-sm leading-6 text-slate-100"}`}>
                                    {isAssistant ? renderMarkdownLite(message.content) : <p className="whitespace-pre-wrap">{message.content}</p>}
                                  </div>
                                )}
                              </div>

                              {!isAssistant ? (
                                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 shadow-sm sm:h-10 sm:w-10">
                                  <UserRound className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </span>
                              ) : null}
                            </article>
                          );
                        })}
                        <div ref={bottomRef} />
                      </div>
                    )}
                  </div>

                  {isSuggestionOpen ? (
                    <aside className="border-t border-slate-200/70 bg-white/92 px-4 py-4 backdrop-blur sm:px-6">
                      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Suggestions</p>
                            <h4 className="text-sm font-semibold text-slate-900">Prompt accelerators</h4>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsSuggestionOpen(false)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
                            aria-label="Close suggestions"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {deferredSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => void runAssistant(suggestion)}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-white hover:text-slate-950"
                          >
                            {suggestion}
                          </button>
                        ))}
                        </div>
                      </div>
                    </aside>
                  ) : null}

                  <div className="border-t border-slate-200/70 bg-white/94 px-3 py-3 backdrop-blur sm:px-4">
                    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-3">
                      {lastFailure ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-amber-200 bg-amber-50/90 px-3 py-3 text-xs text-amber-900 shadow-sm sm:text-sm">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{lastFailure.error.title}</p>
                            <p className="mt-1 text-amber-900/80">{lastFailure.error.detail}</p>
                          </div>
                          {lastFailure.error.retryable ? (
                            <button
                              type="button"
                              onClick={() => void retryLastFailure()}
                              disabled={isStreaming || isLoadingSession || isPreparingAttachment}
                              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-amber-300 bg-white px-3 text-xs font-medium text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <RefreshCcw className="h-3.5 w-3.5" />
                              Retry
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                        <div className="zorvix-composer-row flex flex-nowrap items-end gap-2 sm:gap-3">
                          <div className="min-w-0 flex-1 rounded-[24px] border border-slate-200 bg-white px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                            {activeTopic ? (
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  <span className="truncate">{activeTopic.title}</span>
                                </span>
                              </div>
                            ) : null}

                            {attachment ? (
                              <div className="mb-2.5 rounded-[18px] border border-slate-200 bg-slate-50/90 p-2.5">
                                <div className="flex items-start gap-3">
                                  {attachmentPreview?.kind === "image" && attachmentPreview.previewUrl ? (
                                    <img
                                      src={attachmentPreview.previewUrl}
                                      alt={attachment.filename}
                                      className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-sm"
                                    />
                                  ) : (
                                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
                                      {attachmentPreview?.kind === "file" ? <Paperclip className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                    </span>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="truncate text-sm font-medium text-slate-900">{attachment.filename}</span>
                                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                        {attachmentPreview?.extension || attachmentPreview?.kind || "file"}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                      {attachmentPreview?.snippet || `${formatBytes(attachment.size)} ready for backend processing.`}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => resetAttachment("Attachment removed.")}
                                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:text-slate-700"
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
                              placeholder="Ask Zorvix about cybersecurity, secure architecture, labs, or debugging."
                              className="min-h-[46px] w-full resize-none border-0 bg-transparent px-1 py-1 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 sm:min-h-[52px]"
                              aria-label={`Message ${ZORVIX_NAME}`}
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={(!input.trim() && !attachment) || isStreaming || isLoadingSession || isPreparingAttachment}
                            className="zorvix-button zorvix-send-button inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-3 text-sm font-medium text-white shadow-[0_14px_30px_rgba(15,23,42,0.26)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:px-4"
                          >
                            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            <span className="hidden sm:inline">Send</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              hideFreshSessionBanner();
                              fileInputRef.current?.click();
                            }}
                            disabled={isPreparingAttachment}
                            className="zorvix-button zorvix-action-button inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60 sm:h-11 sm:w-11"
                            aria-label="Attach file"
                            title="Attach file"
                          >
                            {isPreparingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              hideFreshSessionBanner();
                              setIsSuggestionOpen((current) => !current);
                            }}
                            className={`zorvix-button zorvix-action-button inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-sm transition sm:h-11 sm:w-11 ${
                              isSuggestionOpen
                                ? "border-sky-200 bg-sky-50 text-sky-700"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
                            }`}
                            aria-label={isSuggestionOpen ? "Hide suggestions" : "Show suggestions"}
                            title={isSuggestionOpen ? "Hide suggestions" : "Show suggestions"}
                          >
                            <Lightbulb className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-500 sm:text-xs">
                          <span>Enter to send. Shift + Enter for a new line.</span>
                          <span className="max-w-full truncate">
                            {statusTone}
                            {backendHealth?.latency ? ` - ${backendHealth.latency} ms` : ""}
                            {statusHint ? ` - ${statusHint}` : ""}
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


