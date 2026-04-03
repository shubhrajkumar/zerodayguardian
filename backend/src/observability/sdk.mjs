import process from "node:process";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { env } from "../config/env.mjs";

let sdk;
let started = false;

export const startTelemetry = async () => {
  if (!env.otelEnabled || started) return;

  const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: env.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: env.serviceVersion,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env.nodeEnv,
  });

  const traceExporter = new OTLPTraceExporter(
    env.otelEndpoint
      ? {
          url: `${env.otelEndpoint.replace(/\/$/, "")}/v1/traces`,
        }
      : undefined
  );

  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });
  await sdk.start();
  started = true;
};

export const shutdownTelemetry = async () => {
  if (!sdk || !started) return;
  try {
    await sdk.shutdown();
  } finally {
    started = false;
  }
};

export const telemetrySignalHandlers = () => {
  const handler = async () => {
    await shutdownTelemetry();
    process.exit(0);
  };
  process.once("SIGTERM", handler);
};

