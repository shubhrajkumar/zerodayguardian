import { ReactNode, Suspense, lazy, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Zorvix from "@/components/Zorvix";
import AssistantCommandPalette from "@/components/AssistantCommandPalette";
import BackendStatusBanner from "@/components/BackendStatusBanner";

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
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#070b11]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(96,165,250,0.08),transparent_26%),radial-gradient(circle_at_82%_8%,rgba(148,163,184,0.06),transparent_22%),linear-gradient(180deg,#070b11_0%,#0b1018_48%,#070b11_100%)]" />
      {showAmbientVisuals ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <Suspense fallback={null}>
            <AnimatedCyberBackground />
            <InteractiveScene />
          </Suspense>
        </div>
      ) : null}
      <Navbar />
      <BackendStatusBanner />

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
