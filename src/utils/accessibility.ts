import { useEffect, useRef, useState } from "react";

/**
 * useReducedMotion — Detects user preference for reduced motion.
 *
 * 🔍 Cyber Rationale: Respects WCAG SC 2.3.3 (Animation from Interactions).
 * Disables non-essential animations for users with vestibular disorders.
 * Returns true when user prefers reduced motion.
 */
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return prefersReduced;
}

/**
 * announceToScreenReader — Programmatically announces a message to screen readers.
 *
 * Uses an ARIA live region. Creates one if none exists, or reuses the existing one.
 * Call this after dynamic content changes that aren't automatically announced.
 *
 * 🔍 Cyber Rationale: Ensures WCAG SC 4.1.3 (Status Messages) compliance.
 * Screen readers automatically announce content changes inside `aria-live` regions.
 */
export function announceToScreenReader(message: string, politeness: "polite" | "assertive" = "polite"): void {
  if (typeof document === "undefined") return;

  // Find existing announcer or create one
  let announcer = document.getElementById("zdg-screen-reader-announcer") as HTMLDivElement | null;

  if (!announcer) {
    announcer = document.createElement("div");
    announcer.id = "zdg-screen-reader-announcer";
    announcer.setAttribute("aria-live", politeness);
    announcer.setAttribute("aria-atomic", "true");
    announcer.className = "sr-only";
    document.body.appendChild(announcer);
  } else {
    announcer.setAttribute("aria-live", politeness);
  }

  // Clear and set text to force announcement even if same text
  announcer.textContent = "";
  requestAnimationFrame(() => {
    announcer!.textContent = message;
  });
}

/**
 * focusTrap — Creates a focus trap within a container element.
 *
 * Returns a cleanup function. Call when the trap should be removed.
 * Typically used in modals, dialogs, and side panels.
 *
 * 🔍 Cyber Rationale: Ensures WCAG SC 2.1.2 (No Keyboard Trap) compliance.
 * Prevents focus from escaping the modal, while allowing Escape to dismiss.
 *
 * @example
 * ```tsx
 * useEffect(() => focusTrap(modalRef), []);
 * ```
 */
export function focusTrap(containerRef: React.RefObject<HTMLElement | null>): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    if (focusableElements.length === 0) {
      e.preventDefault();
      return;
    }

    const firstEl = focusableElements[0];
    const lastEl = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      }
    } else {
      if (document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  };

  document.addEventListener("keydown", handleKeyDown);

  // Focus the first focusable element
  requestAnimationFrame(() => {
    if (!containerRef.current) return;
    const firstFocusable = containerRef.current.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();
  });

  return () => {
    document.removeEventListener("keydown", handleKeyDown);
  };
}

/**
 * getAriaLabel — Safely returns a string suitable for aria-label from a given value.
 * Falls back to undefined for empty/excluded values.
 */
export function getAriaLabel(label?: string | null): string | undefined {
  if (!label || typeof label !== "string") return undefined;
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
