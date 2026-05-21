import { env } from "../config/env.mjs";
import { getLlmRoutingSnapshot } from "./llmService.mjs";

const PROVIDERS = ["ollama", "local_fallback"];

export const listAiProviders = () => [...PROVIDERS];

export const getProviderPriority = () => env.providerPriority || ["ollama"];

export const getProviderSnapshot = async () => {
  try {
    return await getLlmRoutingSnapshot();
  } catch {
    return {};
  }
};

export const detectProviderOutage = async () => {
  const snapshot = await getProviderSnapshot();
  const providers = snapshot?.providers || snapshot;
  const entries = Object.values(providers || {});
  if (!entries.length) return true;
  return entries.every((entry) => String(entry?.circuit?.state || "").toLowerCase() === "open");
};
