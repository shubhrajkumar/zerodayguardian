import { env } from "../../src/config/env.mjs";

const requireValue = (value, name, issues) => {
  if (!String(value || "").trim()) issues.push(`${name} is required`);
};

const requirePair = (a, b, label, issues) => {
  const hasA = !!String(a || "").trim();
  const hasB = !!String(b || "").trim();
  if (hasA !== hasB) issues.push(`${label} requires both id and secret`);
};

export const validateStartupConfig = () => {
  const issues = [];

  requireValue(env.sessionSecret, "SESSION_SECRET", issues);
  requireValue(env.jwtSecret, "JWT_SECRET", issues);
  requireValue(env.mongoUri, "DATABASE_URL", issues);
  requireValue(env.corsOrigin, "CORS_ORIGIN", issues);

  const llmMode = String(env.llmMode || "ollama").toLowerCase();
  const hasOllama = !!String(env.ollamaBaseUrl || "").trim() && !!String(env.ollamaModel || "").trim();
  if (llmMode === "ollama" && !hasOllama) issues.push("OLLAMA_BASE_URL and OLLAMA_MODEL are required for LLM mode ollama");

  requirePair(env.googleOauthClientId, env.googleOauthClientSecret, "Google OAuth", issues);
  requirePair(env.githubOauthClientId, env.githubOauthClientSecret, "GitHub OAuth", issues);

  if (issues.length) {
    const error = new Error(`Startup validation failed: ${issues.join("; ")}`);
    error.code = "startup_validation_failed";
    error.issues = issues;
    throw error;
  }

  return { ok: true, issues: [] };
};
