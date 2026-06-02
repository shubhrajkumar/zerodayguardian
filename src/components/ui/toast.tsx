import { useEffect, useState } from "react";

export type ToastVariant = "success" | "error" | "info" | "warning";

export type ToastItem = {
  id: string;
  variant: ToastVariant;
  message: string;
};

const VARIANT_STYLES: Record<ToastVariant, { borderColor: string; icon: string; iconColor: string }> = {
  success: {
    borderColor: "var(--accent2, #00ff88)",
    icon: "✓",
    iconColor: "var(--accent2, #00ff88)",
  },
  error: {
    borderColor: "var(--danger, #ff4757)",
    icon: "✕",
    iconColor: "var(--danger, #ff4757)",
  },
  info: {
    borderColor: "var(--accent, #00d4ff)",
    icon: "ℹ",
    iconColor: "var(--accent, #00d4ff)",
  },
  warning: {
    borderColor: "var(--warning, #ffa502)",
    icon: "⚠",
    iconColor: "var(--warning, #ffa502)",
  },
};

let toastCounter = 0;

export function showToast(message: string, variant: ToastVariant = "info") {
  const id = `toast-${++toastCounter}`;
  const event = new CustomEvent<ToastItem>("zdg:toast", {
    detail: { id, variant, message },
  });
  window.dispatchEvent(event);
}

export const ToastContainer = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ToastItem>).detail;
      if (!detail) return;
      setToasts((prev) => [...prev, detail]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== detail.id));
      }, 4000);
    };
    window.addEventListener("zdg:toast", handler);
    return () => window.removeEventListener("zdg:toast", handler);
  }, []);

  if (!toasts.length) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Notifications"
      className="toast-container"
    >
      {toasts.map((toast) => {
        const style = VARIANT_STYLES[toast.variant];
        return (
          <div
            key={toast.id}
            role="alert"
            className="toast"
            style={{
              borderLeft: `3px solid ${style.borderColor}`,
              minWidth: 280,
              maxWidth: "min(420px, calc(100vw - 2rem))",
            }}
          >
            <span style={{ color: style.iconColor, fontSize: "1rem", fontWeight: 600 }} aria-hidden="true">
              {style.icon}
            </span>
            <span style={{ flex: 1 }}>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
