import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("neurobot");
const counters = new Map();
const histograms = new Map();

const labelKey = (labels = {}) =>
  Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",");

export const withSpan = async (name, attributes = {}, fn) =>
  tracer.startActiveSpan(name, { attributes }, async (span) => {
    const started = Date.now();
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      span.setAttribute("duration_ms", Date.now() - started);
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error?.message || error) });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });

export const incMetric = (name, value = 1, labels = {}) => {
  const key = `${name}|${labelKey(labels)}`;
  counters.set(key, (counters.get(key) || 0) + value);
};

export const observeMetric = (name, value, labels = {}) => {
  const key = `${name}|${labelKey(labels)}`;
  const existing = histograms.get(key) || { count: 0, sum: 0, max: 0 };
  existing.count += 1;
  existing.sum += value;
  existing.max = Math.max(existing.max, value);
  histograms.set(key, existing);
};

const parseKey = (full) => {
  const [metric, rawLabels] = full.split("|");
  if (!rawLabels) return { metric, labels: "" };
  const labels = rawLabels
    .split(",")
    .filter(Boolean)
    .map((entry) => {
      const [k, v] = entry.split("=");
      return `${k}="${String(v).replace(/"/g, '\\"')}"`;
    })
    .join(",");
  return { metric, labels: labels ? `{${labels}}` : "" };
};

export const renderPrometheusMetrics = () => {
  const lines = [];
  for (const [key, value] of counters.entries()) {
    const { metric, labels } = parseKey(key);
    lines.push(`${metric}${labels} ${value}`);
  }

  for (const [key, value] of histograms.entries()) {
    const { metric, labels } = parseKey(key);
    lines.push(`${metric}_count${labels} ${value.count}`);
    lines.push(`${metric}_sum${labels} ${value.sum}`);
    lines.push(`${metric}_max${labels} ${value.max}`);
  }

  return `${lines.join("\n")}\n`;
};

