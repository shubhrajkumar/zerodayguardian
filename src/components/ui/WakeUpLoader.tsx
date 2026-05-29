import { useEffect, useState } from "react";

interface WakeUpLoaderProps {
  message?: string;
  subMessage?: string;
  onRetry?: () => void;
  retryCountdown?: number;
  visible: boolean;
}

export const WakeUpLoader = ({
  message = "Connecting to server...",
  subMessage = "This may take 30 seconds on first load",
  onRetry,
  retryCountdown = 0,
  visible,
}: WakeUpLoaderProps) => {
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(retryCountdown);

  // Animated progress bar that simulates connection attempt
  useEffect(() => {
    if (!visible) {
      setProgress(0);
      return;
    }
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90; // cap at 90% until connected
        return prev + Math.random() * 8;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [visible]);

  // Retry countdown timer
  useEffect(() => {
    if (!visible || !onRetry) return;
    setCountdown(retryCountdown);
    if (retryCountdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onRetry();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, retryCountdown, onRetry]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg-primary, #0a0a0f)",
        color: "var(--color-text-primary, #e2e8f0)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
          maxWidth: "380px",
          padding: "32px",
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "var(--color-tag-bg, rgba(0,212,255,0.1))",
            border: "1px solid var(--color-border, rgba(0,212,255,0.15))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
          }}
          aria-hidden="true"
        >
          ⚡
        </div>

        {/* Message */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <p
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 600,
              lineHeight: 1.3,
            }}
          >
            {message}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "var(--color-text-secondary, #94a3b8)",
              lineHeight: 1.4,
            }}
          >
            {subMessage}
          </p>
        </div>

        {/* Animated Progress Bar */}
        <div
          style={{
            width: "100%",
            height: "4px",
            background: "var(--color-bg-input, rgba(255,255,255,0.06))",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background:
                "linear-gradient(90deg, var(--color-accent, #00d4ff), var(--color-accent-green, #00ff88))",
              borderRadius: "2px",
              transition: "width 0.5s ease",
            }}
          />
        </div>

        {/* Retry countdown */}
        {countdown > 0 && (
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--color-text-muted, #475569)",
            }}
          >
            Retrying in {countdown}...
          </p>
        )}
      </div>
    </div>
  );
};

export default WakeUpLoader;
