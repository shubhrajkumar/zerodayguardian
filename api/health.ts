/**
 * Vercel Serverless Function — /api/health
 *
 * Cyber Rationale: Post-deploy health check for Vercel frontend.
 * Returns frontend build status and optionally probes backend health.
 * Used by CI/CD, uptime monitors, and the dashboard health widget.
 *
 * Note: Follows project convention — no @vercel/node import (not in deps).
 * Uses generic types matching api/index.mjs pattern.
 */

interface HealthResponse {
  status: "ok" | "degraded";
  timestamp: string;
  coldStartMs: number;
  version: string;
  frontend: {
    status: "ok";
    framework: string;
    nodeVersion: string;
  };
  backend?: {
    status: "ok" | "error" | "unreachable";
    url: string;
    latencyMs?: number;
  };
}

// Cyber Rationale: Module-level timestamp tracks time since cold start.
// In Vercel serverless, each invocation is a fresh process — "uptime"
// is meaningless; coldStartMs is honest about what's measured.
const coldStartTime = Date.now();

export default async function handler(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vercel serverless convention (matches api/index.mjs)
  req: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vercel serverless convention (matches api/index.mjs)
  res: any,
): Promise<void> {
  // Only allow GET requests
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const response: HealthResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    coldStartMs: Date.now() - coldStartTime,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "unknown",
    frontend: {
      status: "ok",
      framework: "vite-react",
      nodeVersion: process.version,
    },
  };

  // Cyber Rationale: Optionally probe backend health.
  // The backend (Render) may have a cold-start delay, so we don't fail
  // the frontend health check if the backend is unreachable.
  const backendUrl = process.env.VITE_API_BASE_URL;
  if (backendUrl) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const backendRes = await fetch(`${backendUrl}/api/health`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeout);

      response.backend = {
        status: backendRes.ok ? "ok" : "error",
        url: backendUrl,
        latencyMs: Date.now() - start,
      };
    } catch {
      // Cyber Rationale: Backend unreachable is degraded, not error —
      // the frontend itself is still functional.
      response.backend = {
        status: "unreachable",
        url: backendUrl,
      };
      response.status = "degraded";
    }
  }

  const statusCode = response.status === "error" ? 503 : 200;
  res.status(statusCode).json(response);
}
