import { useCallback, useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/react";
import GlassCard from "@/components/ui/GlassCard";

type TestResult = {
  type: "success" | "error" | "info";
  message: string;
  ts: number;
};

const SENTRY_DSN = String(import.meta.env.VITE_SENTRY_DSN || "");

export default function SentryTestPanel() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const addResult = useCallback((r: TestResult) => {
    setResults((prev) => [r, ...prev].slice(0, 20));
  }, []);

  // ── 1. Capture a handled exception ──
  const sendTestError = useCallback(() => {
    setSending("exception");
    try {
      throw new Error("[sentry-test] Handled exception — integration check ✓");
    } catch (e) {
      Sentry.captureException(e);
    }
    // Ensure the event flushes before we show confirmation
    Sentry.flush(2000).then(() => {
      if (!mountedRef.current) return;
      setSending(null);
      addResult({
        type: "success",
        message: "Test exception sent to Sentry. Check your Sentry Issues dashboard.",
        ts: Date.now(),
      });
    });
  }, [addResult]);

  // ── 2. Capture a message ──
  const sendTestMessage = useCallback(() => {
    setSending("message");
    Sentry.captureMessage("[sentry-test] Test message — breadcrumb check ✓", "info");
    Sentry.flush(2000).then(() => {
      if (!mountedRef.current) return;
      setSending(null);
      addResult({
        type: "info",
        message: "Test message sent to Sentry. Check your Sentry Issues dashboard.",
        ts: Date.now(),
      });
    });
  }, [addResult]);

  // ── 3. Trigger an unhandled promise rejection ──
  const sendUnhandledError = useCallback(() => {
    setSending("unhandled");
    addResult({
      type: "info",
      message: "Triggering unhandled promise rejection in 1s… check Sentry dashboard.",
      ts: Date.now(),
    });
    setTimeout(() => {
      // This creates an unhandled promise rejection that Sentry auto-captures
      new Promise((_, reject) =>
        reject(new Error("[sentry-test] Unhandled promise rejection — auto-capture test ✓"))
      );
      if (mountedRef.current) setSending(null);
    }, 1000);
  }, [addResult]);

  // ── 4. Simulate a fetch error (network request) ──
  const sendNetworkError = useCallback(() => {
    setSending("network");
    fetch("https://httpstat.us/500")
      .then((res) => {
        if (!res.ok) throw new Error(`[sentry-test] Network error test — HTTP ${res.status} ✓`);
        return res.text();
      })
      .catch((e) => {
        Sentry.captureException(e, {
          tags: { test_type: "network_error" },
          contexts: { test: { source: "SentryTestPanel" } },
        });
        return Sentry.flush(2000);
      })
      .then(() => {
        if (!mountedRef.current) return;
        setSending(null);
        addResult({
          type: "success",
          message: "Network error simulation sent to Sentry.",
          ts: Date.now(),
        });
      });
  }, [addResult]);

  // ── 5. Send a test error with custom context ──
  const sendRichError = useCallback(() => {
    setSending("rich");
    Sentry.captureException(new Error("[sentry-test] Rich error with custom context ✓"), {
      tags: { test_type: "rich_context", env: import.meta.env.MODE },
      contexts: {
        test: {
          source: "SentryTestPanel",
          component: "SentryTestPanel",
          timestamp: new Date().toISOString(),
        },
        user: {
          id: "test-user",
          role: "admin",
        },
      },
      level: "fatal",
    });
    Sentry.flush(2000).then(() => {
      if (!mountedRef.current) return;
      setSending(null);
      addResult({
        type: "success",
        message: "Rich error with tags/context sent to Sentry.",
        ts: Date.now(),
      });
    });
  }, [addResult]);

  // ── 6. Set user context then send error ──
  const sendWithUserContext = useCallback(() => {
    setSending("user");
    Sentry.setUser({
      id: "test-user-" + Date.now(),
      email: "test@zerodayguardian.com",
      username: "test-guardian",
    });
    Sentry.captureException(new Error("[sentry-test] Error with user context ✓"));
    Sentry.flush(2000).then(() => {
      // Clear the test user so real errors aren't contaminated
      Sentry.setUser(null);
      if (!mountedRef.current) return;
      setSending(null);
      addResult({
        type: "success",
        message: "Error with user context sent. User context was cleared afterward.",
        ts: Date.now(),
      });
    });
  }, [addResult]);

  const isSending = sending !== null;

  const dsnDisplay = SENTRY_DSN
    ? `${SENTRY_DSN.slice(0, 12)}…${SENTRY_DSN.slice(-8)}`
    : "❌ Not set — Sentry is disabled";

  const btnClass =
    "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 " +
    "hover:scale-[1.03] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100";

  return (
    <GlassCard
      className="rounded-2xl border p-5 md:p-6 animate-fade-in-up"
      style={{ borderColor: "color-mix(in srgb, var(--theme-accent-purple) 15%, transparent)" }}
    >
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--theme-text)" }}>
            <span>🧪</span> Sentry Error Tracking
          </h2>
          <p className="mt-1 text-xs" style={{ color: "var(--theme-text-dim)" }}>
            <span className="font-medium">DSN:</span>{" "}
            <code className="rounded bg-[var(--theme-overlay)] px-1.5 py-0.5 font-mono text-[10px]">
              {dsnDisplay}
            </code>
          </p>
        </div>

        {/* SDK status badge */}
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium"
          style={{
            backgroundColor: SENTRY_DSN
              ? "color-mix(in srgb, var(--theme-accent-green) 12%, transparent)"
              : "color-mix(in srgb, var(--theme-accent-red) 12%, transparent)",
            color: SENTRY_DSN ? "var(--theme-accent-green)" : "var(--theme-accent-red)",
            border: `1px solid color-mix(in srgb, ${
              SENTRY_DSN ? "var(--theme-accent-green)" : "var(--theme-accent-red)"
            } 20%, transparent)`,
          }}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${SENTRY_DSN ? "animate-pulse" : ""}`}
            style={{ backgroundColor: SENTRY_DSN ? "var(--theme-accent-green)" : "var(--theme-accent-red)" }}
          />
          {SENTRY_DSN ? "SDK Active" : "SDK Disabled"}
        </div>
      </div>

      {/* Action buttons grid */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <button
          onClick={sendTestError}
          disabled={isSending}
          className={btnClass}
          style={{
            backgroundColor: "color-mix(in srgb, var(--theme-accent-red) 12%, transparent)",
            color: "var(--theme-accent-red)",
            border: "1px solid color-mix(in srgb, var(--theme-accent-red) 20%, transparent)",
          }}
        >
          {sending === "exception" ? "⏳ Sending…" : "🔥 Test Error"}
        </button>

        <button
          onClick={sendTestMessage}
          disabled={isSending}
          className={btnClass}
          style={{
            backgroundColor: "color-mix(in srgb, var(--theme-accent-blue) 12%, transparent)",
            color: "var(--theme-accent-blue)",
            border: "1px solid color-mix(in srgb, var(--theme-accent-blue) 20%, transparent)",
          }}
        >
          {sending === "message" ? "⏳ Sending…" : "💬 Test Message"}
        </button>

        <button
          onClick={sendUnhandledError}
          disabled={isSending}
          className={btnClass}
          style={{
            backgroundColor: "color-mix(in srgb, var(--theme-accent-purple) 12%, transparent)",
            color: "var(--theme-accent-purple)",
            border: "1px solid color-mix(in srgb, var(--theme-accent-purple) 20%, transparent)",
          }}
        >
          {sending === "unhandled" ? "⏳ Triggering…" : "💥 Unhandled Error"}
        </button>

        <button
          onClick={sendNetworkError}
          disabled={isSending}
          className={btnClass}
          style={{
            backgroundColor: "color-mix(in srgb, var(--theme-accent-orange, #f59e0b) 12%, transparent)",
            color: "var(--theme-accent-orange, #f59e0b)",
            border: "1px solid color-mix(in srgb, var(--theme-accent-orange, #f59e0b) 20%, transparent)",
          }}
        >
          {sending === "network" ? "⏳ Sending…" : "🌐 Network Error"}
        </button>

        <button
          onClick={sendRichError}
          disabled={isSending}
          className={btnClass}
          style={{
            backgroundColor: "color-mix(in srgb, var(--theme-accent-green) 12%, transparent)",
            color: "var(--theme-accent-green)",
            border: "1px solid color-mix(in srgb, var(--theme-accent-green) 20%, transparent)",
          }}
        >
          {sending === "rich" ? "⏳ Sending…" : "📦 Rich Error"}
        </button>

        <button
          onClick={sendWithUserContext}
          disabled={isSending}
          className={btnClass}
          style={{
            backgroundColor: "color-mix(in srgb, var(--theme-accent-pink, #ec4899) 12%, transparent)",
            color: "var(--theme-accent-pink, #ec4899)",
            border: "1px solid color-mix(in srgb, var(--theme-accent-pink, #ec4899) 20%, transparent)",
          }}
        >
          {sending === "user" ? "⏳ Sending…" : "👤 User Context"}
        </button>
      </div>

      {/* Result log */}
      {results.length > 0 && (
        <div
          className="max-h-36 space-y-1 overflow-y-auto rounded-lg p-3"
          style={{ backgroundColor: "var(--theme-overlay)" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--theme-text-dim)" }}>
              Results ({results.length})
            </span>
            <button
              onClick={() => setResults([])}
              className="text-[10px] font-medium transition-colors hover:underline"
              style={{ color: "var(--theme-text-dim)" }}
            >
              Clear
            </button>
          </div>
          {results.map((r, i) => (
            <div
              key={r.ts + "-" + i}
              className="flex items-start gap-2 text-xs animate-fade-in"
              style={{ color: "var(--theme-text-muted)" }}
            >
              <span className="mt-0.5 shrink-0">
                {r.type === "success" ? "✅" : r.type === "error" ? "❌" : "ℹ️"}
              </span>
              <span>{r.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer hint */}
      {!SENTRY_DSN && (
        <p className="mt-3 rounded-lg border p-3 text-xs" style={{ borderColor: "color-mix(in srgb, var(--theme-accent-amber, #f59e0b) 20%, transparent)", backgroundColor: "color-mix(in srgb, var(--theme-accent-amber, #f59e0b) 8%, transparent)", color: "var(--theme-accent-amber, #f59e0b)" }}>
          ⚠️ <span className="font-medium">VITE_SENTRY_DSN</span> not set. Set it in Vercel →
          Settings → Environment Variables, then redeploy. You can also set it in a{" "}
          <code className="font-mono text-[10px]">.env</code> file for local testing.
        </p>
      )}
    </GlassCard>
  );
}
