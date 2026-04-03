type DiagnosticLevel = "error" | "warning";
type DebugLevel = DiagnosticLevel | "info";

export type ClientDiagnostic = {
  id: string;
  level: DiagnosticLevel;
  message: string;
  source: string;
  path: string;
  createdAt: number;
};

const STORAGE_KEY = "zdg:client-diagnostics";
const DEBUG_STORAGE_KEY = "zdg:runtime-debug";
const MAX_ITEMS = 25;

const safeRead = (): ClientDiagnostic[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ClientDiagnostic[]) : [];
  } catch {
    return [];
  }
};

const safeWrite = (items: ClientDiagnostic[]) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // ignore storage failures
  }
};

const safeReadDebug = (): Array<{
  id: string;
  level: DebugLevel;
  message: string;
  source: string;
  path: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}> => {
  try {
    const raw = window.localStorage.getItem(DEBUG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const safeWriteDebug = (items: Array<{
  id: string;
  level: DebugLevel;
  message: string;
  source: string;
  path: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}>) => {
  try {
    window.localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(items.slice(0, 60)));
  } catch {
    // ignore storage failures
  }
};

export const getRecentClientDiagnostics = () => {
  if (typeof window === "undefined") return [];
  return safeRead();
};

export const getRecentRuntimeDebugEvents = () => {
  if (typeof window === "undefined") return [];
  return safeReadDebug();
};

export const recordClientDiagnostic = ({
  level = "error",
  message,
  source,
}: {
  level?: DiagnosticLevel;
  message: string;
  source: string;
}) => {
  if (typeof window === "undefined") return;
  const next: ClientDiagnostic = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    message: String(message || "Unknown client issue").slice(0, 240),
    source: String(source || "runtime").slice(0, 80),
    path: window.location.pathname,
    createdAt: Date.now(),
  };
  const items = [next, ...safeRead()].filter(
    (item, index, list) => list.findIndex((candidate) => candidate.message === item.message && candidate.source === item.source && candidate.path === item.path) === index
  );
  safeWrite(items);
};

export const recordRuntimeDebugEvent = ({
  level = "info",
  message,
  source,
  metadata,
}: {
  level?: DebugLevel;
  message: string;
  source: string;
  metadata?: Record<string, unknown>;
}) => {
  if (typeof window === "undefined") return;
  const next = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    message: String(message || "Unknown runtime event").slice(0, 240),
    source: String(source || "runtime").slice(0, 80),
    path: window.location.pathname,
    createdAt: Date.now(),
    metadata,
  };
  safeWriteDebug([next, ...safeReadDebug()]);
  window.dispatchEvent(new CustomEvent("zdg:runtime-debug", { detail: next }));
};

export const installGlobalDiagnostics = () => {
  if (typeof window === "undefined") return;
  const marker = "__zdg_diagnostics_installed__";
  if ((window as typeof window & { [key: string]: unknown })[marker]) return;
  (window as typeof window & { [key: string]: unknown })[marker] = true;

  window.addEventListener("error", (event) => {
    recordClientDiagnostic({
      level: "error",
      message: event.message || "Unhandled window error",
      source: event.filename || "window.error",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      typeof reason === "string"
        ? reason
        : reason instanceof Error
          ? reason.message
          : "Unhandled promise rejection";
    recordClientDiagnostic({
      level: "error",
      message,
      source: "unhandledrejection",
    });
  });
};
