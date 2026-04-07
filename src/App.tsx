import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ComponentType, lazy, LazyExoticComponent, ReactNode, Suspense, useEffect, useRef } from "react";
import { BrowserRouter, matchPath, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as HotToaster } from "react-hot-toast";
import { Toaster as SonnerToaster } from "sonner";
import { Helmet, HelmetProvider } from "react-helmet-async";
import ErrorBoundary from "./components/ErrorBoundary";
import FirebaseStatusBadge from "./components/FirebaseStatusBadge";
import Layout from "./components/Layout";
import RewardExperience from "./components/platform/RewardExperience";
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

const IndexPage = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const NotFoundPage = lazy(() => import("./pages/NotFound"));
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
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));

const SITE_ORIGIN = String(import.meta.env.VITE_SITE_URL || __SITE_URL__ || "https://zerodayguardian-delta.vercel.app").replace(/\/+$/, "");
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/placeholder.svg`;
const SUPPORT_EMAIL = "ksubhraj28@gmail.com";

const shouldRetryRequest = (failureCount: number, error: unknown) => {
  const status = Number((error as { status?: number } | null)?.status || 0);
  if ([400, 401, 403, 404, 409, 422].includes(status)) return false;
  return failureCount < 3;
};

const retryDelay = (attemptIndex: number) => Math.min(800 * 2 ** attemptIndex, 8_000);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: shouldRetryRequest,
      retryDelay,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
      networkMode: "online",
    },
    mutations: {
      retry: (failureCount, error) => shouldRetryRequest(failureCount, error),
      retryDelay,
      networkMode: "online",
    },
  },
});

const RouteFallback = () => (
  <div className="route-skeleton-shell container mx-auto px-4 py-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="shell-command-chip">Deploying command layer</div>
      <div className="route-skeleton-panel space-y-5">
        <div className="skeleton-block h-8 w-40" />
        <div className="skeleton-block h-28 w-full rounded-[1.4rem]" />
        <div className="route-skeleton-grid">
          <div className="route-skeleton-card skeleton-block" />
          <div className="route-skeleton-card skeleton-block" />
          <div className="route-skeleton-card skeleton-block" />
        </div>
      </div>
    </div>
  </div>
);

type RouteSeoConfig = {
  patterns: string[];
  title: string;
  description: string;
  keywords: string;
  buildJsonLd?: (canonical: string) => Record<string, unknown>[];
};

const buildOrganizationJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ZeroDay Guardian",
  url: SITE_ORIGIN,
  logo: `${SITE_ORIGIN}/favicon.ico`,
  email: SUPPORT_EMAIL,
  description: "A cyber-AI SaaS for guided labs, missions, OSINT investigations, and adaptive security mentorship.",
});

const buildWebSiteJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "ZeroDay Guardian",
  url: SITE_ORIGIN,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_ORIGIN}/tools?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
});

const buildCourseJsonLd = (canonical: string) => ({
  "@context": "https://schema.org",
  "@type": "Course",
  name: "ZeroDay Guardian Cyber Learning Path",
  description: "Hands-on cyber missions, real labs, adaptive mentorship, and guided learning tracks inside ZeroDay Guardian.",
  provider: {
    "@type": "Organization",
    name: "ZeroDay Guardian",
    sameAs: SITE_ORIGIN,
  },
  url: canonical,
});

const routeSeoConfig: RouteSeoConfig[] = [
  {
    patterns: ["/"],
    title: "ZeroDay Guardian | Deploy Your Cyber-AI Workspace",
    description: "Deploy missions, labs, OSINT workflows, and adaptive ZORVIX AI guidance inside one premium cybersecurity workspace.",
    keywords: "cybersecurity SaaS, AI cyber mentor, cyber labs, OSINT tools, threat intelligence, zero day guardian",
    buildJsonLd: () => [buildOrganizationJsonLd(), buildWebSiteJsonLd()],
  },
  {
    patterns: ["/dashboard"],
    title: "Threat Dashboard | ZeroDay Guardian",
    description: "Track missions, streaks, badges, referrals, labs, and AI-guided progress from one elite cyber command dashboard.",
    keywords: "cyber dashboard, mission control, security streaks, cyber xp, cyber achievements",
  },
  {
    patterns: ["/learn", "/program", "/program/day/:day"],
    title: "Cyber Learning Paths | ZeroDay Guardian",
    description: "Structured cyber learning paths, guided programs, daily missions, and practical breach-ready training.",
    keywords: "cyber course, cybersecurity learning path, guided cyber training, ethical hacking program",
    buildJsonLd: (canonical) => [buildCourseJsonLd(canonical)],
  },
  {
    patterns: ["/lab"],
    title: "Labs | ZeroDay Guardian",
    description: "Deploy hands-on cybersecurity labs, progress loops, and mission-driven practice with resilient training telemetry.",
    keywords: "cyber labs, security sandbox, penetration testing labs, blue team labs",
  },
  {
    patterns: ["/tools", "/tools/:id"],
    title: "Cyber Tools Hub | ZeroDay Guardian",
    description: "Run production-grade cyber tools, verified scans, and investigation workflows inside one trusted tools hub.",
    keywords: "cybersecurity tools, OSINT tools, website scan, headers scan, web recon",
  },
  {
    patterns: ["/assistant"],
    title: "ZORVIX AI | ZeroDay Guardian",
    description: "ZORVIX AI delivers adaptive cyber guidance, Socratic hints, and pinned mobile-first assistance without clutter.",
    keywords: "AI cyber mentor, cybersecurity assistant, ZORVIX AI, Socratic cyber coach",
  },
  {
    patterns: ["/osint", "/osint/share/:shareId"],
    title: "OSINT Command Center | ZeroDay Guardian",
    description: "Investigate domains, IPs, usernames, and case evidence with a premium OSINT workflow and shareable reports.",
    keywords: "OSINT platform, threat intelligence, whois, dns lookup, cyber investigation",
  },
  {
    patterns: ["/blog", "/blog/:slug", "/resources", "/community"],
    title: "Intel Feed | ZeroDay Guardian",
    description: "Stay sharp with cyber intel, curated resources, live community loops, and field-ready security signals.",
    keywords: "cyber news, security resources, community intelligence, threat feed",
  },
  {
    patterns: ["/about"],
    title: "About ZeroDay Guardian",
    description: "Learn how ZeroDay Guardian helps security learners deploy elite labs, missions, and AI-guided cyber growth.",
    keywords: "about zero day guardian, cybersecurity platform, cyber ai company",
  },
  {
    patterns: ["/privacy", "/terms", "/contact"],
    title: "Trust Center | ZeroDay Guardian",
    description: "Review privacy, terms, support, and trust commitments for the ZeroDay Guardian cyber-AI platform.",
    keywords: "privacy policy, terms of service, contact support, cybersecurity saas trust",
  },
  {
    patterns: ["/auth", "/verify-email", "/security"],
    title: "Secure Access | ZeroDay Guardian",
    description: "Secure your ZeroDay Guardian workspace with hardened auth, verification, and account protection flows.",
    keywords: "cybersecurity auth, secure login, firebase auth, account security",
  },
  {
    patterns: ["/u/:handle"],
    title: "Cyber Portfolio | ZeroDay Guardian",
    description: "Review public cyber progress, badges, and achievement signals from a shareable ZeroDay Guardian profile.",
    keywords: "cyber portfolio, public profile, cybersecurity achievements, cyber resume",
  },
];

const resolveSiteOrigin = () => {
  if (typeof window === "undefined") return SITE_ORIGIN;
  const runtimeOrigin = String(window.location.origin || "").replace(/\/+$/, "");
  return runtimeOrigin || SITE_ORIGIN;
};

const resolveSeo = (pathname: string) =>
  routeSeoConfig.find((entry) => entry.patterns.some((pattern) => Boolean(matchPath(pattern, pathname)))) || routeSeoConfig[0];

const RouteSeo = () => {
  const location = useLocation();
  const seo = resolveSeo(location.pathname);
  const canonical = `${resolveSiteOrigin()}${location.pathname === "/" ? "" : location.pathname}`;
  const jsonLd = seo.buildJsonLd?.(canonical) || [];

  return (
    <Helmet prioritizeSeoTags>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta name="keywords" content={seo.keywords} />
      <meta name="robots" content="index, follow, max-image-preview:large" />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="ZeroDay Guardian" />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={DEFAULT_OG_IMAGE} />
      <meta property="og:image:alt" content="ZeroDay Guardian cyber-AI platform" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
      <link rel="canonical" href={canonical} />
      {jsonLd.map((entry, index) => (
        <script key={`${location.pathname}-schema-${index}`} type="application/ld+json">
          {JSON.stringify(entry)}
        </script>
      ))}
    </Helmet>
  );
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

const RouteBoundary = ({ children }: { children: ReactNode }) => {
  const location = useLocation();

  return (
    <ErrorBoundary key={`${location.pathname}${location.search}`}>
      <div className="page-shell app-smooth-enter">{children}</div>
    </ErrorBoundary>
  );
};

type AppPageComponent = LazyExoticComponent<ComponentType<object>>;
type AppRouteDefinition = {
  path: string;
  component: AppPageComponent;
  requiresAuth?: boolean;
};

const appRoutes: AppRouteDefinition[] = [
  { path: "/", component: IndexPage },
  { path: "/tools", component: ToolsPage },
  { path: "/tools/:id", component: ToolDetail },
  { path: "/learn", component: LearnPage },
  { path: "/program", component: ProgramPage },
  { path: "/assistant", component: AssistantPage },
  { path: "/program/day/:day", component: ProgramLabPage, requiresAuth: true },
  { path: "/lab", component: LabPage },
  { path: "/blog", component: BlogPage },
  { path: "/blog/:slug", component: BlogDetail },
  { path: "/resources", component: ResourcesPage },
  { path: "/community", component: CommunityPage },
  { path: "/osint", component: OsintPage, requiresAuth: true },
  { path: "/osint/share/:shareId", component: OsintSharePage },
  { path: "/about", component: AboutPage },
  { path: "/privacy", component: PrivacyPage },
  { path: "/terms", component: TermsPage },
  { path: "/contact", component: ContactPage },
  { path: "/auth", component: AuthPage },
  { path: "/verify-email", component: VerifyEmailPage },
  { path: "/u/:handle", component: PublicProfilePage },
  { path: "/security", component: SecuritySettingsPage, requiresAuth: true },
  { path: "/dashboard", component: DashboardPage, requiresAuth: true },
];

const renderRouteElement = (PageComponent: AppPageComponent, requiresAuth = false) => {
  const page = (
    <RouteBoundary>
      <PageComponent />
    </RouteBoundary>
  );

  return requiresAuth ? <RequireAuth>{page}</RequireAuth> : page;
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
                    {appRoutes.map((route) => (
                      <Route
                        key={route.path}
                        path={route.path}
                        element={renderRouteElement(route.component, route.requiresAuth)}
                      />
                    ))}
                    <Route path="*" element={renderRouteElement(NotFoundPage)} />
                  </Routes>
                </Suspense>
              </Layout>

              <HotToaster
                position="top-right"
                toastOptions={{
                  duration: 4200,
                  style: {
                    background: "#12121a",
                    color: "#e2e8f0",
                    border: "1px solid #2d2d44",
                  },
                }}
              />
              <SonnerToaster
                position="top-right"
                richColors
                closeButton
                toastOptions={{
                  style: {
                    background: "#12121a",
                    color: "#e2e8f0",
                    border: "1px solid #2d2d44",
                  },
                }}
              />
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
