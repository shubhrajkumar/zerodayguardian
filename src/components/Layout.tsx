import { ReactNode, Suspense, lazy } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Zorvix from "@/components/Zorvix";
import AssistantCommandPalette from "@/components/AssistantCommandPalette";

const InteractiveScene = lazy(() => import("@/components/InteractiveScene"));
const AnimatedCyberBackground = lazy(() => import("@/components/AnimatedCyberBackground"));

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#070b11]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(96,165,250,0.08),transparent_26%),radial-gradient(circle_at_82%_8%,rgba(148,163,184,0.06),transparent_22%),linear-gradient(180deg,#070b11_0%,#0b1018_48%,#070b11_100%)]" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <Suspense fallback={null}>
          <AnimatedCyberBackground />
          <InteractiveScene />
        </Suspense>
      </div>
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
