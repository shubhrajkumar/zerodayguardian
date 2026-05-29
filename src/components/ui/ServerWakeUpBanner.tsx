import { useState, useEffect, useCallback } from "react";

export const ServerWakeUpBanner = () => {
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    const show = () => {
      setVisible(true);
      setCountdown(30);
    };
    window.addEventListener("server-waking-up", show);
    return () => window.removeEventListener("server-waking-up", show);
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (countdown <= 0) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [visible, countdown]);

  const handleRetry = useCallback(() => {
    // Dismiss the banner — the auto-retry in apiClient.ts handles retrying requests
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "linear-gradient(90deg, #0a0a0f, #0f1a2e)",
        borderBottom: "1px solid rgba(0,212,255,0.4)",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        color: "#00d4ff",
        fontSize: "14px",
        fontFamily: "monospace",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          animation: "server-wake-pulse 1s infinite",
          fontSize: "18px",
        }}
      >
        ⚡
      </span>
      <span>
        Server is starting up... Auto-retry in {countdown}s
      </span>
      <div
        style={{
          width: "120px",
          height: "4px",
          background: "rgba(0,212,255,0.2)",
          borderRadius: "2px",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(countdown / 30) * 100}%`,
            background: "#00d4ff",
            transition: "width 1s linear",
            borderRadius: "2px",
          }}
        />
      </div>
      <button
        onClick={handleRetry}
        style={{
          background: "rgba(0,212,255,0.15)",
          border: "1px solid rgba(0,212,255,0.4)",
          color: "#00d4ff",
          padding: "4px 12px",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "12px",
          fontFamily: "monospace",
          transition: "background 0.2s ease",
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.background = "rgba(0,212,255,0.25)";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.background = "rgba(0,212,255,0.15)";
        }}>Retry Now</button>
    </div>
  );
};

export default ServerWakeUpBanner;
