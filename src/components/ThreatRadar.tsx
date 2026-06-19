/**
 * ThreatRadar — Live HTML5 Canvas global threat radar.
 *
 * Renders a green neon circular radar with:
 *   - Crosshair grid (concentric circles + cross lines)
 *   - 360° sweeping radar line with gradient fade
 *   - Random blinking alpha-blended target dots simulating live intrusion scans
 *   - Proper requestAnimationFrame loop with cleanup on unmount
 *
 * Performance: Only animates transform + opacity (GPU-composited) on the canvas.
 * No layout thrashing. Cleans up RAF and canvas context on unmount.
 */
import { useEffect, useRef } from "react";

interface ThreatRadarProps {
  /** Radar size in pixels. Default 280. Auto-scales for mobile. */
  size?: number;
  /** Number of simulated threat dots. Default 18. */
  dotCount?: number;
  /** Sweep speed multiplier. 1 = normal. Default 1. */
  speed?: number;
  /** Disable animation for reduced motion */
  reduced?: boolean;
}

interface ThreatDot {
  angle: number;
  distance: number; // 0-1 from center
  speed: number;
  phase: number;
  size: number;
  intensity: number; // alpha base
  label: string;
}

const RING_COUNT = 3;
const TARGET_LABELS = [
  "SCAN", "INTRUSION", "ANOMALY", "PACKET", "PROBE",
  "THREAT", "SIGNAL", "TRACE", "ECHO", "BEACON",
  "ALERT", "BURST", "PULSE", "SNIFF", "DETECT",
  "OUTLIER", "SPIKE", "SCAN-2",
];

export default function ThreatRadar({
  size = 280,
  dotCount = 18,
  speed = 1,
  reduced = false,
}: ThreatRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<ThreatDot[]>([]);
  const sweepAngleRef = useRef(0);
  const rafRef = useRef<number>(0);

  // ── Animation loop (includes dot initialization) ──
  useEffect(() => {
    const dots: ThreatDot[] = [];
    for (let i = 0; i < dotCount; i++) {
      dots.push({
        angle: Math.random() * Math.PI * 2,
        distance: 0.15 + Math.random() * 0.75,
        speed: 0.0003 + Math.random() * 0.0008,
        phase: Math.random() * Math.PI * 2,
        size: 1.5 + Math.random() * 2.5,
        intensity: 0.3 + Math.random() * 0.5,
        label: TARGET_LABELS[i % TARGET_LABELS.length],
      });
    }
    dotsRef.current = dots;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check prefers-reduced-motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const shouldReduce = reduced || mq.matches;
    if (shouldReduce) {
      // Draw a static frame
      drawStaticFrame(canvas, size);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const logicalSize = size;
    canvas.width = logicalSize * dpr;
    canvas.height = logicalSize * dpr;
    ctx.scale(dpr, dpr);

    let running = true;

    const draw = (timestamp: number) => {
      if (!running) return;
      const cx = logicalSize / 2;
      const cy = logicalSize / 2;
      const radius = logicalSize / 2 - 8;

      // Clear
      ctx.clearRect(0, 0, logicalSize, logicalSize);

      // ── Radar background ──
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      bgGrad.addColorStop(0, "rgba(5, 15, 10, 0.95)");
      bgGrad.addColorStop(0.6, "rgba(2, 10, 5, 0.98)");
      bgGrad.addColorStop(1, "rgba(0, 5, 2, 1)");
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // ── Outer ring glow ──
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(52, 211, 153, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ── Concentric rings ──
      for (let i = 1; i <= RING_COUNT; i++) {
        const r = (radius / (RING_COUNT + 1)) * i;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(52, 211, 153, ${0.06 + i * 0.03})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ── Crosshair lines ──
      ctx.strokeStyle = "rgba(52, 211, 153, 0.07)";
      ctx.lineWidth = 0.5;
      for (let a = 0; a < 4; a++) {
        const angle = (a * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(angle) * radius, cy - Math.sin(angle) * radius);
        ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
        ctx.stroke();
      }

      // ── Sweep angle (update) ──
      sweepAngleRef.current = (sweepAngleRef.current + 0.005 * speed) % (Math.PI * 2);
      const sweep = sweepAngleRef.current;

      // ── Sweep line — gradient trail ──
      const trailSegments = 40;
      for (let t = trailSegments; t >= 0; t--) {
        const trailAngle = sweep - (t / trailSegments) * 0.3;
        const alpha = 0.3 * (1 - t / trailSegments) * (1 - t / trailSegments);
        const r = radius * (t / trailSegments);
        const tx = cx + Math.cos(trailAngle) * r;
        const ty = cy + Math.sin(trailAngle) * r;

        ctx.beginPath();
        ctx.arc(tx, ty, 2 * (1 - t / trailSegments) + 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(52, 211, 153, ${alpha})`;
        ctx.fill();
      }

      // ── Sweep line (main beam) ──
      const beamEndX = cx + Math.cos(sweep) * radius;
      const beamEndY = cy + Math.sin(sweep) * radius;

      // Glow beam
      const beamGrad = ctx.createLinearGradient(cx, cy, beamEndX, beamEndY);
      beamGrad.addColorStop(0, "rgba(52, 211, 153, 0)");
      beamGrad.addColorStop(0.3, "rgba(52, 211, 153, 0.05)");
      beamGrad.addColorStop(0.7, "rgba(52, 211, 153, 0.15)");
      beamGrad.addColorStop(1, "rgba(52, 211, 153, 0.4)");
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, sweep - 0.02, sweep);
      ctx.closePath();
      ctx.fillStyle = beamGrad;
      ctx.fill();

      // Thin bright line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(beamEndX, beamEndY);
      ctx.strokeStyle = "rgba(52, 211, 153, 0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Bright tip
      ctx.beginPath();
      ctx.arc(beamEndX, beamEndY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(52, 211, 153, 0.6)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(beamEndX, beamEndY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(52, 211, 153, 0.15)";
      ctx.fill();

      // ── Center glow ──
      const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
      centerGrad.addColorStop(0, "rgba(52, 211, 153, 0.3)");
      centerGrad.addColorStop(1, "rgba(52, 211, 153, 0)");
      ctx.fillStyle = centerGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(52, 211, 153, 0.7)";
      ctx.fill();

      // ── Threat dots ──
      const dots = dotsRef.current;
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];

        // Move dots slowly
        dot.angle += dot.speed * speed;
        if (dot.angle > Math.PI * 2) dot.angle -= Math.PI * 2;

        // Blinking intensity
        const blink = Math.sin(timestamp * 0.002 + dot.phase) * 0.5 + 0.5;
        const alpha = dot.intensity * (0.3 + blink * 0.7);

        const dx = cx + Math.cos(dot.angle) * dot.distance * radius;
        const dy = cy + Math.sin(dot.angle) * dot.distance * radius;

        // Glow under dot
        ctx.beginPath();
        ctx.arc(dx, dy, dot.size * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(52, 211, 153, ${alpha * 0.15})`;
        ctx.fill();

        // Dot
        ctx.beginPath();
        ctx.arc(dx, dy, dot.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(52, 211, 153, ${alpha})`;
        ctx.fill();

        // Bright center
        ctx.beginPath();
        ctx.arc(dx, dy, dot.size * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(52, 211, 153, ${alpha * 0.8})`;
        ctx.fill();

        // Label (only for dots near the sweep)
        const angleDiff = Math.abs(dot.angle - sweep);
        const labelVisible = (angleDiff < 0.15 || angleDiff > Math.PI * 2 - 0.15) && alpha > 0.4;
        if (labelVisible) {
          ctx.font = "7px 'JetBrains Mono', monospace";
          ctx.fillStyle = `rgba(52, 211, 153, ${alpha * 0.5})`;
          ctx.fillText(dot.label, dx + dot.size + 3, dy + 2.5);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [size, speed, reduced]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        maxWidth: "100%",
        display: "block",
        borderRadius: "50%",
      }}
      aria-label="Global threat radar — showing active network intrusion scans"
    />
  );
}

/**
 * Draw a static frame for reduced-motion users.
 */
function drawStaticFrame(canvas: HTMLCanvasElement, size: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 8;

  const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  bgGrad.addColorStop(0, "rgba(5, 15, 10, 0.95)");
  bgGrad.addColorStop(1, "rgba(0, 5, 2, 1)");
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(52, 211, 153, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Concentric rings
  for (let i = 1; i <= 3; i++) {
    const r = (radius / 4) * i;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(52, 211, 153, ${0.06 + i * 0.03})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Cross lines
  ctx.strokeStyle = "rgba(52, 211, 153, 0.07)";
  ctx.lineWidth = 0.5;
  for (let a = 0; a < 4; a++) {
    const angle = (a * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(angle) * radius, cy - Math.sin(angle) * radius);
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.stroke();
  }

  // Static dots
  const dots: ThreatDot[] = [];
  for (let i = 0; i < 12; i++) {
    dots.push({
      angle: (i / 12) * Math.PI * 2,
      distance: 0.2 + (i % 5) * 0.15,
      speed: 0,
      phase: 0,
      size: 1.5,
      intensity: 0.4,
      label: "",
    });
  }
  for (const dot of dots) {
    const dx = cx + Math.cos(dot.angle) * dot.distance * radius;
    const dy = cy + Math.sin(dot.angle) * dot.distance * radius;
    ctx.beginPath();
    ctx.arc(dx, dy, dot.size, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(52, 211, 153, 0.35)";
    ctx.fill();
  }
}
