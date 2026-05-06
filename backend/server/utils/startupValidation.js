import { env, REQUIRED_ENV_KEYS, assertStartupEnv, getStartupEnvValidation } from "../../src/config/env.mjs";
import { logInfo, logWarn } from "../../src/utils/logger.mjs";

const requirePair = (a, b, label, issues) => {
  const hasA = !!String(a || "").trim();
  const hasB = !!String(b || "").trim();
  if (hasA !== hasB) issues.push(`${label} requires both id and secret`);
};

export const validateStartupConfig = ({ enforceInProduction = true } = {}) => {
  const report = getStartupEnvValidation();
  const issues = [...report.issues.map((issue) => `${issue.key}: ${issue.message}`)];
  const llmMode = String(env.llmMode || "ollama").toLowerCase();
  const hasOllama = !!String(env.ollamaBaseUrl || "").trim() && !!String(env.ollamaModel || "").trim();
  if (llmMode === "ollama" && !hasOllama) issues.push("OLLAMA_BASE_URL and OLLAMA_MODEL are required for LLM mode ollama");

  requirePair(env.githubOauthClientId, env.githubOauthClientSecret, "GitHub OAuth", issues);

  logInfo("Startup env validation complete", {
    environment: env.nodeEnv,
    requiredKeys: REQUIRED_ENV_KEYS,
    missingKeys: report.missingKeys,
    warningCount: report.warnings.length,
    errorCount: report.errors.length,
  });
  if (report.warnings.length) {
    logWarn("Startup env validation warnings", {
      issues: report.warnings.map((issue) => `${issue.key}: ${issue.message}`),
    });
  }

  if (issues.length) {
    const shouldEnforce = enforceInProduction && env.nodeEnv === "production";
    if (shouldEnforce) {
      assertStartupEnv({ enforceProduction: true });
      const error = new Error(`Startup validation failed: ${issues.join("; ")}`);
      error.code = "startup_validation_failed";
      error.issues = issues;
      throw error;
    }
    logWarn("Startup validation issues detected; continuing because production enforcement is disabled", {
      issues,
    });
  }

  return {
    ok: issues.length === 0,
    enforced: enforceInProduction && env.nodeEnv === "production",
    issues,
    report,
  };
};
