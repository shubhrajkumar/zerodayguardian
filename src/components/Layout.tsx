import { ReactNode, Suspense, lazy, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Zorvix from "@/components/Zorvix";
import AssistantCommandPalette from "@/components/AssistantCommandPalette";

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
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(circle at 18% 12%, rgba(96,165,250,0.08), transparent 26%), radial-gradient(circle at 82% 8%, rgba(148,163,184,0.06), transparent 22%), linear-gradient(180deg, var(--theme-bg) 0%, color-mix(in srgb, var(--theme-bg) 60%, var(--theme-accent-blue) 5%) 48%, var(--theme-bg) 100%)" }} />
      {showAmbientVisuals ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <Suspense fallback={null}>
            <AnimatedCyberBackground />
            <InteractiveScene />
          </Suspense>
        </div>
      ) : null}
      <Navbar />

      <main className="relative z-10 min-w-0 flex-1 pt-16">
        {children}
      </main>

      <div className="relative z-10">
        <Footer />
      </div>
      <AssistantCommandPalette />
      <Zorvix />
    </div>
  );
};

export default Layout;
