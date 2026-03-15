import { incMetric, observeMetric, renderPrometheusMetrics, withSpan } from "../observability/telemetry.mjs";
import { logError, logInfo, logWarn } from "../utils/logger.mjs";

export const telemetry = Object.freeze({
  incMetric,
  observeMetric,
  renderPrometheusMetrics,
  withSpan,
});

export const logger = Object.freeze({
  info: logInfo,
  warn: logWarn,
  error: logError,
});

