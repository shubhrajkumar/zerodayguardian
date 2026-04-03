import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useRef } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as HotToaster } from "react-hot-toast";
import { Toaster as SonnerToaster } from "sonner";
import { HelmetProvider } from "react-helmet-async";
import ErrorBoundary from "./components/ErrorBoundary";
import FirebaseStatusBadge from "./components/FirebaseStatusBadge";
import Layout from "./components/Layout";
import RewardExperience from "./components/platform/RewardExperience";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";
import RequireAuth from "./components/RequireAuth";
import { clearAnonymousClientState } from "./lib/apiClient";
import { UserProgressProvider, useUserProgress } from "./context/UserProgressContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LearningModeProvider } from "./context/LearningModeContext";
import { MissionSystemProvider } from "./context/MissionSystemApiContext";
import { AdaptiveMentorProvider } from "./context/AdaptiveMentorContext";
import { warmHighIntentRoutes } from "./lib/routeWarmup";
import { useScrollReveal } from "./hooks/useScrollReveal";
import { useGrowthProfileSync } from "./hooks/useGrowthFeatures";

const ToolsPage = lazy(() => import("./pages/ToolsPage"));
const ToolDetail = lazy(() => import("./pages/ToolDetail"));
const LearnPage = lazy(() => import("./pages/LearnPage"));
const ProgramPage = lazy(() => import("./pages/ProgramPage"));
const ProgramLabPage = lazy(() => import("./pages/ProgramLabPage"));
const LabPage = lazy(() => import("./pages/LabPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogDetail = lazy(() => import("./pages/BlogDetail"));
const ResourcesPage = lazy(() => import("./pages/ResourcesPage"));
const CommunityPage = lazy(() => import("./pages/CommunityPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const OsintPage = lazy(() => import("./pages/OsintPage"));
const OsintSharePage = lazy(() => import("./pages/OsintSharePage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const SecuritySettingsPage = lazy(() => import("./pages/SecuritySettingsPage"));
const AssistantPage = lazy(() => import("./pages/AssistantPage"));
const PublicProfilePage = lazy(() => import("./pages/PublicProfilePage"));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
      networkMode: "online",
    },
    mutations: {
      retry: 0,
      networkMode: "online",
    },
  },
});

const RouteFallback = () => (
  <div className="container mx-auto px-4 py-12">
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-full bg-white/10" />
      <div className="h-28 animate-pulse rounded-[28px] border border-cyan-300/12 bg-white/[0.03]" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-32 animate-pulse rounded-3xl border border-cyan-300/12 bg-white/[0.03]" />
        <div className="h-32 animate-pulse rounded-3xl border border-cyan-300/12 bg-white/[0.03]" />
        <div className="h-32 animate-pulse rounded-3xl border border-cyan-300/12 bg-white/[0.03]" />
      </div>
    </div>
  </div>
);

const RouteSeo = () => {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname;
    const titleMap: Record<string, string> = {
      "/": "ZeroDay Guardian | AI Cybersecurity Workspace",
      "/dashboard": "Growth Dashboard | ZeroDay Guardian",
      "/lab": "Labs | ZeroDay Guardian",
      "/osint": "OSINT | ZeroDay Guardian",
      "/community": "Community | ZeroDay Guardian",
      "/tools": "Tools Hub | ZeroDay Guardian",
    };
    const descriptionMap: Record<string, string> = {
      "/": "AI-powered cybersecurity workspace with verified OSINT, website scans, labs, and guided threat analysis.",
      "/dashboard": "Growth-ready cybersecurity dashboard with referrals, shareable insights, streak loops, smart notifications, and resilient real-time debugging.",
      "/lab": "Mission-based cybersecurity labs with simulated training flows, streaks, badges, and guided practice.",
      "/osint": "Verified OSINT investigations with DNS, MX, WHOIS, headers, and evidence-driven case management.",
      "/community": "Community intelligence, weekly missions, leaderboard progression, and practical cybersecurity discussion.",
      "/tools": "Trusted tools hub for verified scans, premium UI, and real security workflows without fabricated data.",
    };
    document.title = titleMap[pathname] || "ZeroDay Guardian";

    const metaDescription = document.querySelector('meta[name="description"]') || document.createElement("meta");
    metaDescription.setAttribute("name", "description");
    metaDescription.setAttribute("content", descriptionMap[pathname] || descriptionMap["/"]);
    if (!metaDescription.parentNode) document.head.appendChild(metaDescription);

    const canonical = document.querySelector('link[rel="canonical"]') || document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", `${window.location.origin}${pathname}`);
    if (!canonical.parentNode) document.head.appendChild(canonical);
  }, [location.pathname]);

  return null;
};

const GlobalScrollReveal = () => {
  const location = useLocation();
  useScrollReveal([location.pathname, location.search]);
  return null;
};

const GamificationTracker = () => {
  const location = useLocation();
  const { trackAction } = useUserProgress();
  const lastTrackedRef = useRef("");

  useEffect(() => {
    const routeKey = `${location.pathname}${location.search}`;
    if (lastTrackedRef.current === routeKey) return;
    lastTrackedRef.current = routeKey;
    trackAction({
      type: "page_view",
      tool: "navigation",
      query: routeKey,
      depth: 1,
      success: true,
      metadata: { path: location.pathname },
    }).catch(() => undefined);
  }, [location.pathname, location.search, trackAction]);

  return null;
};

const GrowthProfileSync = () => {
  useGrowthProfileSync();
  return null;
};

const AppShell = () => {
  const { authState, isAuthenticated } = useAuth();

  useEffect(() => {
    if (authState === "loading" || isAuthenticated) return;
    clearAnonymousClientState();
  }, [authState, isAuthenticated]);

  useEffect(() => warmHighIntentRoutes(), []);

  return (
    <UserProgressProvider>
      <MissionSystemProvider>
        <LearningModeProvider>
          <AdaptiveMentorProvider>
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <RouteSeo />
              <GlobalScrollReveal />
              <GamificationTracker />
              <GrowthProfileSync />
              <FirebaseStatusBadge />
              <RewardExperience />
              <Layout>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/tools" element={<ToolsPage />} />
                    <Route path="/tools/:id" element={<ToolDetail />} />
                    <Route path="/learn" element={<LearnPage />} />
                    <Route path="/program" element={<ProgramPage />} />
                    <Route path="/assistant" element={<AssistantPage />} />
                    <Route
                      path="/program/day/:day"
                      element={
                        <RequireAuth>
                          <ProgramLabPage />
                        </RequireAuth>
                      }
                    />
                    <Route path="/lab" element={<LabPage />} />
                    <Route path="/blog" element={<BlogPage />} />
                    <Route path="/blog/:slug" element={<BlogDetail />} />
                    <Route path="/resources" element={<ResourcesPage />} />
                    <Route path="/community" element={<CommunityPage />} />
                    <Route
                      path="/osint"
                      element={
                        <RequireAuth>
                          <OsintPage />
                        </RequireAuth>
                      }
                    />
                    <Route path="/osint/share/:shareId" element={<OsintSharePage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/verify-email" element={<VerifyEmailPage />} />
                    <Route path="/u/:handle" element={<PublicProfilePage />} />
                    <Route
                      path="/security"
                      element={
                        <RequireAuth>
                          <SecuritySettingsPage />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/dashboard"
                      element={
                        <RequireAuth>
                          <DashboardPage />
                        </RequireAuth>
                      }
                    />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </Layout>

              <HotToaster />
              <SonnerToaster />
            </BrowserRouter>
          </AdaptiveMentorProvider>
        </LearningModeProvider>
      </MissionSystemProvider>
    </UserProgressProvider>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <ErrorBoundary>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </ErrorBoundary>
      </HelmetProvider>
    </QueryClientProvider>
  );
}
