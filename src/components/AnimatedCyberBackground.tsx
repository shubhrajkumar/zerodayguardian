import { useEffect, useState } from "react";

interface AnimatedCyberBackgroundProps {
  /** Reduce animation intensity */
  reduced?: boolean;
}

export default function AnimatedCyberBackground({ reduced = false }: AnimatedCyberBackgroundProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Gradient base */}
      <div className="absolute inset-0 bg-[var(--theme-bg)]" />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 212, 255, 0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 212, 255, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at 50% 30%, black 30%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black 30%, transparent 70%)",
        }}
      />

      {/* Glowing orbs */}
      <div
        className={`absolute -top-[20%] -left-[10%] w-[60%] aspect-square rounded-full opacity-[0.12] blur-[120px] ${reduced ? "animate-none" : "animate-float"}`}
        style={{
          background: "radial-gradient(circle, rgba(0, 212, 255, 0.6), transparent 70%)",
        }}
      />
      <div
        className={`absolute -bottom-[20%] -right-[10%] w-[50%] aspect-square rounded-full opacity-[0.08] blur-[100px] ${reduced ? "animate-none" : "animate-float"}`}
        style={{
          background: "radial-gradient(circle, rgba(0, 255, 136, 0.5), transparent 70%)",
          animationDelay: "-2s",
        }}
      />
      <div
        className="absolute top-[40%] right-[5%] w-[30%] aspect-square rounded-full opacity-[0.06] blur-[80px]"
        style={{
          background: "radial-gradient(circle, rgba(123, 47, 247, 0.5), transparent 70%)",
        }}
      />

      {/* Scan line (subtle) */}
      {!reduced && (
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            background: "linear-gradient(180deg, transparent 0%, rgba(0, 212, 255, 0.5) 50%, transparent 100%)",
            backgroundSize: "100% 8px",
            animation: "scan-line 8s linear infinite",
          }}
        />
      )}

      {/* Subtle vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)",
        }}
      />
    </div>
  );
}
