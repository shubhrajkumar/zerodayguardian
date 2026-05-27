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

// Sentry SDK silently no-ops when DSN is undefined — no guard needed.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
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
  tracesSampleRate: 1.0, // Full tracing for maximum visibility
  tracePropagationTargets: [
    "localhost",
    /^https?:\/\/(zerodayguardian|zeroday-guardian)(-[a-z0-9-]+)?\.(vercel\.app|onrender\.com)/,
  ],

  // ── Session Replay ──
  replaysSessionSampleRate: 0.1,  // 10% of all sessions
  replaysOnErrorSampleRate: 1.0,  // 100% of sessions with errors

  // ── Logging ──
  enableLogs: true,

  // ── Debug (set debug: true temporarily to troubleshoot missing events) ──
  // debug: import.meta.env.MODE === "development",
});
