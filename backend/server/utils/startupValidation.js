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

  const llmMode = String(env.llmMode || "auto").toLowerCase();
  const openaiKey = !!String(env.openaiApiKey || "").trim();
  const googleKey = !!String(env.googleApiKey || "").trim();
  if (llmMode === "openai" && !openaiKey) issues.push("OPENAI_API_KEY is required for LLM mode openai");
  if (llmMode === "google" && !googleKey) issues.push("GOOGLE_API_KEY is required for LLM mode google");
  if (llmMode === "auto" && !openaiKey && !googleKey) issues.push("At least one provider key is required in auto mode");

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
