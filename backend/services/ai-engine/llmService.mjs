import { env } from "../../src/config/env.mjs";
import {
  requestLlm as routedRequestLlm,
  requestLlmStream as routedRequestLlmStream,
  verifyLlmConnection as routedVerifyLlmConnection,
  getLlmRoutingSnapshot,
  getLlmQueueSnapshot,
  startLlmHealthMonitor as routedStartLlmHealthMonitor,
  stopLlmHealthMonitor as routedStopLlmHealthMonitor,
  runLlmSelfDiagnosis as routedRunLlmSelfDiagnosis,
  classifyLlmError as routedClassifyLlmError,
  validateLlmStartupConfig as routedValidateLlmStartupConfig,
} from "../../src/llm/index.mjs";

export const requestLlm = async (payload) => routedRequestLlm(payload);

export const requestLlmStream = async (payload) => routedRequestLlmStream(payload);

export const verifyLlmConnection = async ({ timeoutMs = env.llmCriticalTimeoutMs } = {}) =>
  routedVerifyLlmConnection({ timeoutMs });

export { getLlmRoutingSnapshot };
export { getLlmQueueSnapshot };

export const runLlmSelfDiagnosis = async ({ timeoutMs = Math.min(30000, env.llmCriticalTimeoutMs) } = {}) =>
  routedRunLlmSelfDiagnosis({ timeoutMs });

export const classifyLlmError = (error) => routedClassifyLlmError(error);

export const validateLlmStartupConfig = () => routedValidateLlmStartupConfig();
export const startLlmHealthMonitor = () => routedStartLlmHealthMonitor();
export const stopLlmHealthMonitor = () => routedStopLlmHealthMonitor();
