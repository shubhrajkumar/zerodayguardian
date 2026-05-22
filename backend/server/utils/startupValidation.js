import { env, REQUIRED_ENV_KEYS, assertStartupEnv, getStartupEnvValidation } from "../../src/config/env.mjs";
import { logInfo, logWarn } from "../../src/utils/logger.mjs";
import { getGoogleAuthConfigStatus } from "../../services/security-service/authService.mjs";

const requirePair = (a, b, label, issues) => {
  const hasA = !!String(a || "").trim();
  const hasB = !!String(b || "").trim();
  if (hasA !== hasB) issues.push(`${label} requires both id and secret`);
};

export const validateStartupConfig = ({ enforceInProduction = true } = {}) => {
  const report = getStartupEnvValidation();
  const warningIssues = report.warnings.map((issue) => `${issue.key}: ${issue.message}`);
  const blockingIssues = report.errors.map((issue) => `${issue.key}: ${issue.message}`);
  const llmMode = String(env.llmMode || "ollama").toLowerCase();
  const hasOllama = !!String(env.ollamaBaseUrl || "").trim() && !!String(env.ollamaModel || "").trim();
  if (llmMode === "ollama" && !hasOllama) {
    blockingIssues.push("OLLAMA_BASE_URL and OLLAMA_MODEL are required for LLM mode ollama");
  }

  requirePair(env.githubOauthClientId, env.githubOauthClientSecret, "GitHub OAuth", blockingIssues);

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
  const googleAuth = getGoogleAuthConfigStatus();
  if (!googleAuth.enabled) {
    const hasInvalidConfig = Boolean(googleAuth.invalidKeys?.length);
    const logGoogleAuthStatus = hasInvalidConfig ? logWarn : logInfo;
    logGoogleAuthStatus("Google auth disabled", {
      missingKeys: googleAuth.missingKeys,
      invalidKeys: googleAuth.invalidKeys,
      action: googleAuth.invalidKeys?.length
        ? "Fix invalid Google OAuth environment variables or remove them to keep Google sign-in disabled."
        : "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend environment to enable Google sign-in.",
    });
  }

  const issues = [...blockingIssues, ...warningIssues];
  if (blockingIssues.length) {
    const shouldEnforce = enforceInProduction && env.nodeEnv === "production";
    if (shouldEnforce) {
      assertStartupEnv({ enforceProduction: true });
      const error = new Error(`Startup validation failed: ${blockingIssues.join("; ")}`);
      error.code = "startup_validation_failed";
      error.issues = blockingIssues;
      throw error;
    }
    logWarn("Startup validation issues detected; continuing because production enforcement is disabled", {
      issues: blockingIssues,
    });
  }

  return {
    ok: blockingIssues.length === 0,
    enforced: enforceInProduction && env.nodeEnv === "production",
    issues: blockingIssues,
    warnings: warningIssues,
    report,
  };
};
