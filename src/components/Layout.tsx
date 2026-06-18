import { ReactNode, Suspense, lazy, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Swords } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AssistantCommandPalette from "@/components/AssistantCommandPalette";
import CookieConsent from "@/components/CookieConsent";

/** Premium ZORVIX AI floating launcher — Cyber Mentor with holographic pulse */
function ZorvixLauncher() {
  const navigate = useNavigate();
  return (
    <div className="fixed bottom-6 right-6 z-[1400]">
      <button
        type="button"
        onClick={() => navigate("/assistant")}
        className="group relative inline-flex items-center gap-3 rounded-full border border-cyan-500/30 bg-gradient-to-br from-slate-900/90 to-slate-800/90 px-3 py-3 text-left shadow-lg shadow-cyan-500/10 backdrop-blur-xl transition-all duration-300 hover:border-cyan-400/60 hover:shadow-[0_0_32px_rgba(34,211,238,0.15)] hover:scale-105 active:scale-95 sm:px-4 hologram-card"
        aria-label="Open ZORVIX AI Cyber Mentor"
      >
        {/* Signal pulse rings */}
        <span className="absolute -inset-1 animate-ping-slow rounded-full border border-cyan-400/20 opacity-75" />
        <span className="absolute -inset-2 animate-ping-slower rounded-full border border-emerald-400/10 opacity-40" />
        <span className="absolute -inset-3 rounded-full border border-purple-400/5 opacity-20 animate-signal-pulse" />
        
        {/* Holographic icon */}
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/30 bg-gradient-to-br from-cyan-500/15 to-emerald-500/10 text-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.1)] transition-all duration-300 group-hover:shadow-[0_0_24px_rgba(34,211,238,0.2)]">
          <Swords className="h-5 w-5" />
        </span>
        
        <span className="hidden min-w-0 sm:block">
          <strong className="block text-sm font-semibold tracking-tight text-slate-100">ZORVIX AI</strong>
          <span className="block text-xs text-cyan-400/70">Cyber Mentor Online</span>
        </span>
      </button>
    </div>
  );
}

const InteractiveScene = lazy(() => import("@/components/InteractiveScene"));
const AnimatedCyberBackground = lazy(() => import("@/components/AnimatedCyberBackground"));

interface LayoutProps {
  children: ReactNode;
}

const shouldRenderAmbientVisuals = () => {
  if (typeof window === "undefined") return false;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const compactViewport = window.matchMedia("(max-width: 1023px)").matches;
  return !prefersReducedMotion && !compactViewport;
};

const Layout = ({ children }: LayoutProps) => {
  const [showAmbientVisuals, setShowAmbientVisuals] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const compactViewportQuery = window.matchMedia("(max-width: 1023px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncAmbientState = () => setShowAmbientVisuals(shouldRenderAmbientVisuals());

    syncAmbientState();
    compactViewportQuery.addEventListener("change", syncAmbientState);
    reducedMotionQuery.addEventListener("change", syncAmbientState);

    return () => {
      compactViewportQuery.removeEventListener("change", syncAmbientState);
      reducedMotionQuery.removeEventListener("change", syncAmbientState);
    };
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden" style={{ backgroundColor: "var(--theme-bg)" }}>
      {/* Cyber scanline overlay */}
      <div className="cyber-scanline-overlay" />
      {/* Ambient background layers */}
      <div className="pointer-events-none absolute inset-0 bg-tactical-radial" />
      {showAmbientVisuals ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <Suspense fallback={null}>
            <AnimatedCyberBackground />
            <InteractiveScene />
          </Suspense>
        </div>
      ) : null}

      {/* Accessibility skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-xl focus:bg-gradient-to-r focus:from-cyan-500 focus:to-emerald-500 focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-[#050508] focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      <Navbar />

      <main id="main-content" className="relative z-10 min-w-0 flex-1 pt-16" role="main" tabIndex={-1}>
        {children}
      </main>

      <div className="relative z-10">
        <Footer />
      </div>

      <AssistantCommandPalette />
      <ZorvixLauncher />
      <CookieConsent />
    </div>
  );
};

export default Layout;
