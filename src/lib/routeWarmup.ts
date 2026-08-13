type RouteKey =
  | "dashboard"
  | "lab"
  | "tools"
  | "osint"
  | "scan";

const routeLoaders: Record<RouteKey, () => Promise<unknown>> = {
  dashboard: () => import("@/pages/DashboardPage"),
  lab: () => import("@/pages/LabPage"),
  tools: () => import("@/pages/ToolsPage"),
  osint: () => import("@/pages/OsintPage"),
  scan: () => import("@/pages/ScanPage"),
};

const loadedRoutes = new Set<RouteKey>();

export const preloadRoute = (route: RouteKey) => {
  if (loadedRoutes.has(route)) return;
  loadedRoutes.add(route);
  routeLoaders[route]().catch(() => {
    loadedRoutes.delete(route);
  });
};

export const preloadRoutes = (routes: RouteKey[]) => {
  routes.forEach(preloadRoute);
};

export const warmHighIntentRoutes = () => {
  const run = () => preloadRoutes(["dashboard", "lab", "tools", "scan"]);
  if (typeof window === "undefined") return;

  const idleScheduler = window.requestIdleCallback
    ? window.requestIdleCallback(() => run(), { timeout: 1800 })
    : window.setTimeout(run, 900);

  return () => {
    if (typeof idleScheduler !== "number" && window.cancelIdleCallback) {
      window.cancelIdleCallback(idleScheduler);
      return;
    }
    window.clearTimeout(idleScheduler as number);
  };
};
