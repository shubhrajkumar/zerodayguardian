import { lazy, ReactNode, Suspense, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const InteractiveScene = lazy(() => import("@/components/InteractiveScene"));
const Zorvix = lazy(() => import("@/components/Zorvix"));
const AnimatedCyberBackground = lazy(() => import("@/components/AnimatedCyberBackground"));
const CursorGlowTrail = lazy(() => import("@/components/CursorGlowTrail"));

const ZorvixFallback = () => (
  <div className="zorvix-fallback-card">
    <span className="zorvix-fallback-badge">Zorvix AI</span>
    <span className="zorvix-fallback-copy">Loading workspace...</span>
  </div>
);

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [allowHeavyVisuals, setAllowHeavyVisuals] = useState(true);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactViewport = window.matchMedia("(max-width: 767px)");
    const update = () => setAllowHeavyVisuals(!(reducedMotion.matches || compactViewport.matches));
    update();
    reducedMotion.addEventListener("change", update);
    compactViewport.addEventListener("change", update);
    return () => {
      reducedMotion.removeEventListener("change", update);
      compactViewport.removeEventListener("change", update);
    };
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col">
      {allowHeavyVisuals ? (
        <Suspense fallback={null}>
          <AnimatedCyberBackground />
          <div className="soc-particles-layer" aria-hidden="true" />
          <div className="soc-grid-shell" aria-hidden="true" />
          <InteractiveScene />
        </Suspense>
      ) : null}

      <Navbar />

      {/* Main content with top padding for fixed navbar */}
      <main className="relative z-10 flex-1 pt-16">
        {children}
      </main>

      <div className="relative z-10">
        <Footer />
      </div>

      <Suspense fallback={<ZorvixFallback />}>
        <Zorvix />
        {allowHeavyVisuals ? <CursorGlowTrail /> : null}
      </Suspense>
    </div>
  );
};

export default Layout;
