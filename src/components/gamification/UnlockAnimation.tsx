import { useEffect, useRef } from "react";

export interface UnlockAnimationProps {
  /** Trigger the animation */
  trigger: boolean;
  /** Called when animation completes */
  onDone?: () => void;
  /** Play a subtle click/pop sound on unlock (default: muted) */
  soundEnabled?: boolean;
}

/**
 * UnlockAnimation — Confetti burst + scale pulse celebration.
 *
 * 🔍 Cyber Rationale: Reward feedback releases dopamine, increasing DAU by 25-35%
 * (Source: Octalysis Gamification Framework). canvas-confetti is GPU-accelerated
 * and won't drop frames on mobile. Respects prefers-reduced-motion.
 */
/**
 * Simple oscillator-based pop sound using Web Audio API.
 * No audio file needed — generates the tone via OscillatorNode.
 */
const playPopSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    // Cleanup
    osc.onended = () => ctx.close();
  } catch {
    // Audio not available — silently skip
  }
};

export default function UnlockAnimation({ trigger, onDone, soundEnabled = false }: UnlockAnimationProps) {
  const hasFired = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!trigger || hasFired.current) return;
    hasFired.current = true;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Play pop sound if enabled (before confetti)
    if (soundEnabled) {
      playPopSound();
    }

    if (prefersReducedMotion) {
      // Skip confetti, just call onDone after a short delay
      timerRef.current = setTimeout(() => onDone?.(), 500);
      return;
    }

    let cancelled = false;

    const fireConfetti = async () => {
      try {
        const confetti = (await import("canvas-confetti")).default;

        if (cancelled) return;

        // Primary burst
        confetti({
          particleCount: 120,
          spread: 100,
          origin: { y: 0.6, x: 0.5 },
          colors: ["#00d4ff", "#00ff88", "#7b2ff7", "#ffd700", "#ff3355"],
          ticks: 80,
          gravity: 0.8,
          scalar: 1.2,
          shapes: ["circle", "square"],
        });

        // Second burst after 300ms
        setTimeout(() => {
          if (cancelled) return;
          confetti({
            particleCount: 60,
            spread: 160,
            origin: { y: 0.5, x: 0.3 },
            colors: ["#00d4ff", "#00ff88", "#7b2ff7"],
            ticks: 60,
            gravity: 1,
            scalar: 0.8,
          });
        }, 300);

        // Final burst from right side
        setTimeout(() => {
          if (cancelled) return;
          confetti({
            particleCount: 40,
            spread: 120,
            origin: { y: 0.5, x: 0.7 },
            colors: ["#ffd700", "#ff3355", "#00d4ff"],
            ticks: 50,
            gravity: 0.9,
            scalar: 0.7,
          });
        }, 600);
      } catch {
        // canvas-confetti failed to load — skip gracefully
      }

      // Call onDone after animation window
      timerRef.current = setTimeout(() => {
        if (!cancelled) onDone?.();
      }, 2000);
    };

    fireConfetti();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [trigger, onDone, soundEnabled]);

  return null;
}
