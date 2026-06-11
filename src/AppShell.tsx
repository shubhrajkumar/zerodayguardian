/**
 * AppShell — Lazy-loaded application shell containing all context providers,
 * routing, helper components, and route configuration.
 *
 * Extracted from App.tsx to reduce the critical path JS bundle.
 * Loaded via React.lazy() after the initial paint.
 */
import { ComponentType, lazy, LazyExoticComponent, ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { BrowserRouter, matchPath, Route, Routes, useLocation } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import SEOManager, { type JsonLdEntry } from "./components/SEOManager";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import WakeUpLoader from "./components/ui/WakeUpLoader";
import ServerWakeUpBanner from "./components/ui/ServerWakeUpBanner";
import { clearAnonymousClientState } from "./lib/apiClient";
import { UserProgressProvider, useUserProgress } from "./context/UserProgressContext";
import { useAuth } from "./context/AuthContext";
import { LearningModeProvider } from "./context/LearningModeContext";
import { MissionSystemProvider } from "./context/MissionSystemApiContext";
import { AdaptiveMentorProvider } from "./context/AdaptiveMentorContext";
import { GamificationProvider } from "./context/GamificationContext";
import { warmHighIntentRoutes } from "./lib/routeWarmup";
import { useScrollReveal } from "./hooks/useScrollReveal";
import { useGrowthProfileSync } from "./hooks/useGrowthFeatures";
import { ToastContainer } from "./components/ui/toast";

// ── Deferred imports: loaded after initial paint ──
const LazyToasters = lazy(() =>
  Promise.all([
    import("react-hot-toast"),
    import("sonner"),
  ]).then(([hotMod, sonnerMod]) => {
    const HotToaster = hotMod.Toaster;
    const SonnerToaster = sonnerMod.Toaster;
    return {
      default: () => (
        <>
          <HotToaster
            position="top-right"
            toastOptions={{
              duration: 4200,
              style: {
                background: "var(--theme-card)",
                color: "var(--theme-text)",
                border: "1px solid var(--theme-border)",
              },
            }}
          />
          <SonnerToaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              style: {
                background: "var(--theme-card)",
                color: "var(--theme-text)",
                border: "1px solid var(--theme-border)",
              },
            }}
          />
        </>
      ),
    };
  })
);
const LazyFirebaseStatusBadge = lazy(() => import("./components/FirebaseStatusBadge"));
const RewardExperience = lazy(() => import("./components/platform/RewardExperience"));

// ── Lazy-loaded page components ──
const IndexPage = lazy(() => import("./pages/HomePage"));
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
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const MissionsPage = lazy(() => import("./pages/MissionsPage"));
const ComingSoonLabsPage = lazy(() => import("./components/ComingSoonLabs"));
const RoadmapPage = lazy(() => import("./pages/RoadmapPage"));
const DemoNmapLab = lazy(() => import("./pages/Labs/DemoNmapLab"));

// ── Site config ──
const SITE_ORIGIN = String(import.meta.env.VITE_SITE_URL || __SITE_URL__ || "").replace(/\/+$/, "");
const SUPPORT_EMAIL = "ksubhraj28@gmail.com";

// ── SEO Config ──
type RouteSeoConfig = {
  patterns: string[];
  title: string;
  description: string;
  keywords: string;
  buildJsonLd?: (canonical: string) => JsonLdEntry[];
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
    patterns: ["/labs", "/labs/demo-nmap"],
    title: "Interactive Cyber Labs | ZeroDay Guardian",
    description: "Explore hands-on cybersecurity labs including the free Nmap port scanner demo. Experience ZeroDay Guardian's interactive learning environment.",
    keywords: "cyber labs, nmap demo, free scan lab, cybersecurity labs, hands-on security",
  },
  {
    patterns: ["/roadmap"],
    title: "60-Day Cyber Roadmap | ZeroDay Guardian",
    description: "Follow a structured 60-day cybersecurity learning path — from recon fundamentals to binary exploitation. Track your progress and unlock each day.",
    keywords: "cybersecurity roadmap, 60-day plan, ethical hacking path, cyber learning journey",
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
  {
    patterns: ["/profile"],
    title: "My Profile | ZeroDay Guardian",
    description: "View your XP, streak, badges, leaderboard rank, and recent activity.",
    keywords: "cyber profile, xp, streak, badges, leaderboard",
  },
  {
    patterns: ["/missions"],
    title: "Missions | ZeroDay Guardian",
    description: "Complete daily and weekly missions to earn XP, level up, and unlock achievement badges.",
    keywords: "cyber missions, daily missions, weekly missions, xp, achievements",
  },
];

// ── Helper: resolve site origin ──
const resolveSiteOrigin = () => {
  if (typeof window === "undefined") return SITE_ORIGIN;
  const runtimeOrigin = String(window.location.origin || "").replace(/\/+$/, "");
  return runtimeOrigin || SITE_ORIGIN;
};

const resolveSeo = (pathname: string) =>
  routeSeoConfig.find((entry) => entry.patterns.some((pattern) => Boolean(matchPath(pattern, pathname)))) || routeSeoConfig[0];

// ── Route SEO Component ──
// Cyber Rationale: Centralized SEO via SEOManager prevents duplicate/conflicting
// meta tags and ensures consistent OpenGraph rendering across all routes.
const RouteSeo = () => {
  const location = useLocation();
  const seo = resolveSeo(location.pathname);
  const canonicalPath = location.pathname === "/" ? "/" : location.pathname;
  const jsonLd = seo.buildJsonLd?.(
    `${resolveSiteOrigin()}${canonicalPath === "/" ? "" : canonicalPath}`,
  ) || [];

  return (
    <SEOManager
      title={seo.title}
      description={seo.description}
      path={canonicalPath}
      keywords={seo.keywords}
      jsonLd={jsonLd}
    />
  );
};

// ── Skeleton Fallback ──
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

// ── Utility Components ──
const GlobalScrollReveal = () => {
  const location = useLocation();
  useScrollReveal([location.pathname, location.search]);
  return null;
};

const ColdStartWatcher = () => {
  const [coldStart, setColdStart] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const retryRef = useRef<() => void>(() => {});

  useEffect(() => {
    const handleColdStart = () => {
      setColdStart(true);
      setRetryCountdown(3);
      retryRef.current = () => {};
    };

    const handleApiSuccess = () => {
      setColdStart(false);
    };

    window.addEventListener("api:coldstart", handleColdStart);
    window.addEventListener("api:success", handleApiSuccess);
    return () => {
      window.removeEventListener("api:coldstart", handleColdStart);
      window.removeEventListener("api:success", handleApiSuccess);
    };
  }, []);

  return (
    <WakeUpLoader
      visible={coldStart}
      message="Server is waking up, retrying..."
      subMessage="This may take 30 seconds on first load"
      retryCountdown={retryCountdown}
      onRetry={() => {
        retryRef.current?.();
        setColdStart(false);
      }}
    />
  );
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

// ── Route Definitions ──
type AppPageComponent = LazyExoticComponent<ComponentType<object>>;
type AppRouteDefinition = {
  path: string;
  component: AppPageComponent;
  requiresAuth?: boolean;
};

const appRoutes: AppRouteDefinition[] = [
  { path: "/", component: IndexPage },
  { path: "/tools", component: ToolsPage, requiresAuth: true },
  { path: "/tools/:id", component: ToolDetail, requiresAuth: true },
  { path: "/learn", component: LearnPage, requiresAuth: true },
  { path: "/program", component: ProgramPage, requiresAuth: true },
  { path: "/assistant", component: AssistantPage, requiresAuth: true },
  { path: "/program/day/:day", component: ProgramLabPage, requiresAuth: true },
  { path: "/lab", component: LabPage, requiresAuth: true },
  { path: "/labs", component: ComingSoonLabsPage },
  { path: "/labs/demo-nmap", component: DemoNmapLab },
  { path: "/roadmap", component: RoadmapPage },
  { path: "/blog", component: BlogPage, requiresAuth: true },
  { path: "/blog/:slug", component: BlogDetail, requiresAuth: true },
  { path: "/resources", component: ResourcesPage, requiresAuth: true },
  { path: "/community", component: CommunityPage, requiresAuth: true },
  { path: "/osint", component: OsintPage, requiresAuth: true },
  { path: "/osint/share/:shareId", component: OsintSharePage, requiresAuth: true },
  { path: "/about", component: AboutPage, requiresAuth: true },
  { path: "/privacy", component: PrivacyPage, requiresAuth: true },
  { path: "/terms", component: TermsPage, requiresAuth: true },
  { path: "/contact", component: ContactPage, requiresAuth: true },
  { path: "/auth", component: AuthPage },
  { path: "/verify-email", component: VerifyEmailPage, requiresAuth: true },
  { path: "/u/:handle", component: PublicProfilePage, requiresAuth: true },
  { path: "/security", component: SecuritySettingsPage, requiresAuth: true },
  { path: "/dashboard", component: DashboardPage, requiresAuth: true },
  { path: "/profile", component: ProfilePage, requiresAuth: true },
  { path: "/missions", component: MissionsPage, requiresAuth: true },
];

const renderRouteElement = (PageComponent: AppPageComponent, requiresAuth = false) => {
  const page = (
    <RouteBoundary>
      <PageComponent />
    </RouteBoundary>
  );
  return requiresAuth ? <RequireAuth>{page}</RequireAuth> : page;
};

// ── AppShell: the main app shell (lazy-loaded) ──
export default function AppShell() {
  const { authState, isAuthenticated, user } = useAuth();

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
            <GamificationProvider userId={user?.id} handle={user?.name}>
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
              <Suspense fallback={null}><LazyFirebaseStatusBadge /></Suspense>
              <RewardExperience />
              <ServerWakeUpBanner />
              <ColdStartWatcher />
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

              <Suspense fallback={null}><LazyToasters /></Suspense>
              <ToastContainer />
            </BrowserRouter>
            </GamificationProvider>
          </AdaptiveMentorProvider>
        </LearningModeProvider>
      </MissionSystemProvider>
    </UserProgressProvider>
  );
}
