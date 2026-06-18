import { useEffect, useRef, useState } from "react";

interface AnimatedCyberBackgroundProps {
  /** Reduce animation intensity */
  reduced?: boolean;
  /** Show on mobile */
  forceMobile?: boolean;
  /** Scene intensity: 0-3 (default 2) */
  intensity?: number;
}

const MATRIX_CHARS = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";
const DATA_STREAM_COUNT = 10;
const FLOATING_PARTICLES = 20;

export default function AnimatedCyberBackground({
  reduced = false,
  forceMobile = false,
  intensity = 2,
}: AnimatedCyberBackgroundProps) {
  const [mounted, setMounted] = useState(false);
  const [canAnimate, setCanAnimate] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    setCanAnimate(!mq.matches && (forceMobile || !isMobile));
  }, [forceMobile]);

  // Matrix rain canvas effect
  useEffect(() => {
    if (!canAnimate || reduced || intensity < 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let resizeTimeout: ReturnType<typeof setTimeout>;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resize, 100);
    };

    resize();

    const fontSize = 10;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array.from({ length: columns }, () =>
      Math.random() * -100
    );

    const drawMatrix = () => {
      ctx.fillStyle = "rgba(5, 5, 8, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i += Math.max(1, Math.floor(4 - intensity))) {
        const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Fade from bright cyan to dim
        const opacity = Math.max(0, Math.min(0.6, 0.6 - (y / canvas.height) * 0.4));
        ctx.fillStyle = `rgba(34, 211, 238, ${opacity})`;
        ctx.fillText(char, x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += 0.5 + Math.random() * 0.5;
      }

      animationId = requestAnimationFrame(drawMatrix);
    };

    if (intensity >= 2) {
      drawMatrix();
    }

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [canAnimate, reduced, intensity]);

  if (!mounted) return null;

  const DATA_STREAMS = Array.from({ length: DATA_STREAM_COUNT }, (_, i) => ({
    left: `${8 + i * (82 / DATA_STREAM_COUNT)}%`,
    delay: `${i * 0.6}s`,
    duration: `${3 + (i % 4) * 1.2}s`,
    height: `${20 + (i % 3) * 15}%`,
  }));

  const PARTICLES = Array.from({ length: FLOATING_PARTICLES }, (_, i) => ({
    left: `${(i * 5.1 + 3) % 100}%`,
    top: `${(i * 7.3 + 11) % 100}%`,
    size: 1.5 + (i % 3) * 1.5,
    delay: `${i * 0.4}s`,
    duration: `${12 + (i % 6) * 3}s`,
    opacity: 0.3 + (i % 4) * 0.15,
  }));

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Base layer */}
      <div className="absolute inset-0 bg-[#050508]" />

      {/* Matrix rain canvas */}
      {canAnimate && !reduced && intensity >= 2 && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 opacity-[0.25]"
          style={{ filter: "blur(0.5px)" }}
        />
      )}

      {/* Ambient gradient orbs — enhanced */}
      <div
        className={`absolute -top-[10%] -left-[5%] w-[50%] aspect-square rounded-full ${canAnimate && !reduced ? "animate-orb-float" : ""}`}
        style={{
          background: "radial-gradient(circle, rgba(34, 211, 238, 0.12), transparent 70%)",
          animationDuration: "10s",
        }}
      />
      <div
        className={`absolute -bottom-[10%] -right-[5%] w-[40%] aspect-square rounded-full ${canAnimate && !reduced ? "animate-orb-float" : ""}`}
        style={{
          background: "radial-gradient(circle, rgba(52, 211, 153, 0.08), transparent 70%)",
          animationDuration: "12s",
          animationDelay: "-4s",
        }}
      />
      <div
        className="absolute top-[20%] right-[10%] w-[20%] aspect-square rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(167, 139, 250, 0.06), transparent 70%)",
        }}
      />
      <div
        className={`absolute top-[60%] left-[15%] w-[15%] aspect-square rounded-full ${canAnimate && !reduced ? "animate-orb-float" : ""}`}
        style={{
          background: "radial-gradient(circle, rgba(251, 191, 36, 0.04), transparent 70%)",
          animationDuration: "14s",
          animationDelay: "-2s",
        }}
      />

      {/* Dense cyber grid with perspective */}
      <div
        className={`absolute inset-0 ${canAnimate && !reduced ? "animate-grid-pan" : ""}`}
        style={{
          opacity: intensity >= 3 ? 0.2 : 0.12,
          backgroundImage: `
            linear-gradient(rgba(34, 211, 238, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 211, 238, 0.06) 1px, transparent 1px)
          `,
          backgroundSize: `48px 48px`,
          maskImage: "radial-gradient(ellipse at 50% 30%, black 30%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black 30%, transparent 70%)",
        }}
      />

      {/* Floating particles */}
      {canAnimate && !reduced && PARTICLES.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-cyan-400"
          style={{
            left: p.left,
            top: p.top,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animation: `particle-drift ${p.duration} ease-in-out infinite`,
            animationDelay: p.delay,
            boxShadow: `0 0 ${p.size * 2}px rgba(34, 211, 238, ${p.opacity * 0.5})`,
          }}
        />
      ))}

      {/* Data streams */}
      {canAnimate && !reduced && DATA_STREAMS.map((stream, i) => (
        <div
          key={i}
          className="absolute w-px"
          style={{
            left: stream.left,
            top: `${10 + (i % 3) * 10}%`,
            height: stream.height,
            background: `linear-gradient(180deg, 
              transparent, 
              rgba(34, 211, 238, ${0.15 + (i % 3) * 0.1}), 
              rgba(52, 211, 153, ${0.1 + (i % 3) * 0.08}), 
              transparent
            )`,
            animation: `data-stream ${stream.duration} linear infinite`,
            animationDelay: stream.delay,
            opacity: 0.6,
          }}
        />
      ))}

      {/* Scan line overlay */}
      {!reduced && (
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, transparent 0%, rgba(34, 211, 238, 0.03) 50%, transparent 100%)",
            backgroundSize: "100% 4px",
            animation: canAnimate ? "scan-line 5s linear infinite" : "none",
          }}
        />
      )}

      {/* Extra ambient glow layer */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 30% 20%, rgba(52, 211, 153, 0.03) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 80%, rgba(34, 211, 238, 0.02) 0%, transparent 50%)
          `,
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)",
        }}
      />
    </div>
  );
}
