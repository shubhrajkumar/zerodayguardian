/**
 * Sentry instrumentation — MUST be imported before any other module.
 *
 * This sidecar file initializes Sentry as early as possible so that errors,
 * transactions, and replays are captured from app start. It follows the
 * Sentry React SDK skill guide pattern for React 18 + React Router v6 + Vite.
 *
 * Import order (in main.tsx):
 *   1. import "./instrument";  // ← this file, first
 *   2. import { StrictMode } from "react";
 *   3. import App from "./App";
 */

import * as Sentry from "@sentry/react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import React from "react";

// ── Guard: skip Sentry init if no DSN (e.g. local dev builds) ──
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || "production",
    release: import.meta.env.VITE_APP_VERSION as string | undefined,

    // ── PII: include IP / request headers for debugging ──
    sendDefaultPii: true,

    integrations: [
      // Browser automatic tracing (page loads, navigation, XHR/fetch)
      Sentry.browserTracingIntegration(),

      // React Router v6 — names transactions by route (/dashboard, /tools/:id, …)
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect: React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),

      // Session replay — captures user interactions around errors
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // ── Tracing ──
    tracesSampleRate: 0.1, // 10% in production — adjust as needed
    tracePropagationTargets: [
      "localhost",
      /^https:\/\/api\.zerodayguardian\.com/, // adjust to match your backend
    ],

    // ── Session Replay ──
    replaysSessionSampleRate: 0.1,  // 10% of all sessions
    replaysOnErrorSampleRate: 1.0,  // 100% of sessions with errors

    // ── Logging ──
    enableLogs: true,

    // ── Debug (set debug: true temporarily to troubleshoot missing events) ──
    // debug: import.meta.env.MODE === "development",
  });

  console.info("[sentry] SDK initialized with DSN.");
} else {
  console.info("[sentry] VITE_SENTRY_DSN not set — Sentry disabled.");
}
