import {
  classifyLlmError as llmClassifyError,
  getLlmQueueSnapshot as llmQueueSnapshot,
  getLlmRoutingSnapshot as llmRoutingSnapshot,
  runLlmSelfDiagnosis as llmSelfDiagnosis,
  startLlmHealthMonitor as llmStartHealthMonitor,
  stopLlmHealthMonitor as llmStopHealthMonitor,
  validateLlmStartupConfig as llmValidateStartup,
  verifyLlmConnection as llmVerifyConnection,
} from "../services/llmService.mjs";
import { getToolEngineMeta } from "../tools/engine.mjs";
import { executeAiPipeline, inspectAiPipeline, streamAiPipeline } from "./orchestrator.mjs";

const engineMeta = Object.freeze({
  id: "zorvix-ai-engine",
  version: "2.0.0",
  providers: ["openrouter", "openai", "deepseek", "google", "ollama", "ollama_backup", "local_fallback"],
  transport: ["sync", "stream"],
  toolEngine: getToolEngineMeta(),
});

export const getAiEngineMeta = () => engineMeta;
export const routeAiRequest = async (payload) => executeAiPipeline(payload);
export const routeAiStreamRequest = async (payload) => streamAiPipeline(payload);
export const inspectAiRoute = async (payload) => inspectAiPipeline(payload);
export const verifyAiEngine = async ({ timeoutMs } = {}) => llmVerifyConnection({ timeoutMs });
export const getAiRoutingSnapshot = async () => llmRoutingSnapshot();
export const getAiQueueSnapshot = () => llmQueueSnapshot();
export const runAiSelfDiagnosis = async ({ timeoutMs } = {}) => llmSelfDiagnosis({ timeoutMs });
export const classifyAiError = (error) => llmClassifyError(error);
export const validateAiStartupConfig = () => llmValidateStartup();
export const startAiHealthMonitor = () => llmStartHealthMonitor();
export const stopAiHealthMonitor = () => llmStopHealthMonitor();
