type LogLevel = "info" | "warn" | "error";

type LogPayload = {
  message: string;
  source: string;
  metadata?: Record<string, unknown>;
};

const emit = (level: LogLevel, payload: LogPayload) => {
  const entry = {
    level,
    message: payload.message,
    source: payload.source,
    metadata: payload.metadata || {},
    createdAt: new Date().toISOString(),
  };

  if (level === "error") {
    console.error(`[${payload.source}] ${payload.message}`, entry.metadata);
    return;
  }
  if (level === "warn") {
    console.warn(`[${payload.source}] ${payload.message}`, entry.metadata);
    return;
  }
  console.info(`[${payload.source}] ${payload.message}`, entry.metadata);
};

export const logger = {
  info: (message: string, source: string, metadata?: Record<string, unknown>) =>
    emit("info", { message, source, metadata }),
  warn: (message: string, source: string, metadata?: Record<string, unknown>) =>
    emit("warn", { message, source, metadata }),
  error: (message: string, source: string, metadata?: Record<string, unknown>) =>
    emit("error", { message, source, metadata }),
};

