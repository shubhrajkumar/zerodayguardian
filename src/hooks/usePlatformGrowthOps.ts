import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { ApiError, apiGetJson, apiPostJson } from "@/lib/apiClient";
import { subscribeToPushManager } from "@/lib/pushNotifications";

type CertificationMilestone = {
  id: string;
  title: string;
  xp: number;
  completed: boolean;
  completedAt: string | null;
};

type CertificationPath = {
  id: string;
  title: string;
  provider: string;
  premium: boolean;
  premiumLocked: boolean;
  summary: string;
  enrolledAt: string | null;
  completionPct: number;
  completedCount: number;
  milestones: CertificationMilestone[];
};

type WeeklyCtfEvent = {
  id: string;
  weekKey: string;
  title: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  joined: boolean;
  challenges: Array<{ id: string; title: string; category: string; prompt: string; points: number }>;
  submissions: Array<{ challengeId: string; correct: boolean; submittedAt: string; pointsAwarded: number }>;
  leaderboard: Array<{ userId: string; name: string; score: number }>;
};

type PlatformOverview = {
  user: { id: string; name: string; email: string };
  push: { configured: boolean; subscriptions: number; publicKey: string };
  digest: { enabled: boolean; email: string; lastSentAt: string | null; configured: boolean };
  streakFreeze: { available: number; grantedWeekKey: string; history: Array<{ at: string; reason: string }> };
  certifications: CertificationPath[];
  ctfEvent: WeeklyCtfEvent;
  github: { connected: boolean; owner: string; repo: string; defaultBranch: string; reviewConfigured: boolean };
  billing: {
    planId: string;
    status: string;
    plans: Array<{ id: string; name: string; priceMonthly: number; features: string[]; current: boolean; checkoutReady: boolean }>;
  };
};

const overviewKey = ["platform-growth-overview"];

const EMPTY_PLATFORM_OVERVIEW: PlatformOverview = {
  user: { id: "", name: "Operator", email: "" },
  push: { configured: false, subscriptions: 0, publicKey: "" },
  digest: { enabled: false, email: "", lastSentAt: null, configured: false },
  streakFreeze: { available: 0, grantedWeekKey: "", history: [] },
  certifications: [],
  ctfEvent: {
    id: "weekly-ctf-pending",
    weekKey: "",
    title: "Weekly CTF unavailable",
    summary: "Growth overview is still warming up. Refresh once your session is stable.",
    startsAt: "",
    endsAt: "",
    joined: false,
    challenges: [],
    submissions: [],
    leaderboard: [],
  },
  github: { connected: false, owner: "", repo: "", defaultBranch: "main", reviewConfigured: false },
  billing: {
    planId: "free",
    status: "inactive",
    plans: [
      { id: "free", name: "Free", priceMonthly: 0, features: [], current: true, checkoutReady: true },
      { id: "premium", name: "Premium", priceMonthly: 0, features: [], current: false, checkoutReady: false },
      { id: "team", name: "Team", priceMonthly: 0, features: [], current: false, checkoutReady: false },
    ],
  },
};

export const usePlatformGrowthOps = () => {
  const { authState, isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const overviewQuery = useQuery({
    queryKey: [...overviewKey, user?.id || "anonymous"],
    enabled: authState === "authenticated" && isAuthenticated,
    queryFn: async () => {
      try {
        const response = await apiGetJson<{ overview: PlatformOverview }>("/api/platform/growth/overview");
        return response.overview;
      } catch (error) {
        if (error instanceof ApiError && [400, 401, 403, 404, 424, 500].includes(error.status)) {
          return {
            ...EMPTY_PLATFORM_OVERVIEW,
            user: {
              id: user?.id || "",
              name: user?.name || "Operator",
              email: user?.email || "",
            },
          };
        }
        throw error;
      }
    },
    staleTime: 20_000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status < 500) return false;
      return failureCount < 1;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: overviewKey });

  const enablePushMutation = useMutation({
    mutationFn: async (publicKey: string) => {
      const subscription = await subscribeToPushManager(publicKey);
      return apiPostJson("/api/platform/push/subscribe", subscription);
    },
    onSuccess: invalidate,
  });

  const sendTestPushMutation = useMutation({
    mutationFn: () => apiPostJson("/api/platform/push/test", {}),
  });

  const updateDigestMutation = useMutation({
    mutationFn: (payload: { email: string; enabled: boolean }) => apiPostJson("/api/platform/digest/preferences", payload),
    onSuccess: invalidate,
  });

  const sendDigestMutation = useMutation({
    mutationFn: () => apiPostJson("/api/platform/digest/send-now", {}),
    onSuccess: invalidate,
  });

  const useFreezeMutation = useMutation({
    mutationFn: () => apiPostJson("/api/platform/streak-freeze/use", {}),
    onSuccess: invalidate,
  });

  const enrollMutation = useMutation({
    mutationFn: (pathId: string) => apiPostJson(`/api/platform/certifications/${pathId}/enroll`, {}),
    onSuccess: invalidate,
  });

  const milestoneMutation = useMutation({
    mutationFn: (payload: { pathId: string; milestoneId: string; completed: boolean }) =>
      apiPostJson(`/api/platform/certifications/${payload.pathId}/milestones/${payload.milestoneId}`, {
        completed: payload.completed,
      }),
    onSuccess: invalidate,
  });

  const joinCtfMutation = useMutation({
    mutationFn: () => apiPostJson("/api/platform/ctf/weekly/join", {}),
    onSuccess: invalidate,
  });

  const submitFlagMutation = useMutation({
    mutationFn: (payload: { challengeId: string; flag: string }) =>
      apiPostJson<{ result: { correct: boolean; pointsAwarded: number } }>("/api/platform/ctf/weekly/submit", payload),
    onSuccess: invalidate,
  });

  const connectGithubMutation = useMutation({
    mutationFn: (payload: { owner: string; repo: string; defaultBranch: string }) => apiPostJson("/api/platform/github/connect", payload),
    onSuccess: invalidate,
  });

  const reviewPullRequestMutation = useMutation({
    mutationFn: (pullNumber: number) => apiPostJson<{ result: { summary: string; findings: string[]; riskScore: number; url: string } }>(
      "/api/platform/github/review-pr",
      { pullNumber }
    ),
  });

  const checkoutMutation = useMutation({
    mutationFn: (planId: "premium" | "team") => apiPostJson<{ result: { url: string } }>("/api/platform/billing/checkout", { planId }),
  });

  const syncCheckoutMutation = useMutation({
    mutationFn: (sessionId: string) => apiPostJson("/api/platform/billing/sync", { sessionId }),
    onSuccess: invalidate,
  });

  const portalMutation = useMutation({
    mutationFn: () => apiPostJson<{ result: { url: string } }>("/api/platform/billing/portal", {}),
  });

  const activeCertification = useMemo(
    () => overviewQuery.data?.certifications.find((item) => item.enrolledAt) || overviewQuery.data?.certifications[0] || null,
    [overviewQuery.data]
  );

  return {
    ...overviewQuery,
    activeCertification,
    enablePush: enablePushMutation.mutateAsync,
    enablePushPending: enablePushMutation.isPending,
    sendTestPush: sendTestPushMutation.mutateAsync,
    sendTestPushPending: sendTestPushMutation.isPending,
    updateDigest: updateDigestMutation.mutateAsync,
    updateDigestPending: updateDigestMutation.isPending,
    sendDigestNow: sendDigestMutation.mutateAsync,
    sendDigestPending: sendDigestMutation.isPending,
    useStreakFreeze: useFreezeMutation.mutateAsync,
    useStreakFreezePending: useFreezeMutation.isPending,
    enrollCertification: enrollMutation.mutateAsync,
    updateMilestone: milestoneMutation.mutateAsync,
    joinWeeklyCtf: joinCtfMutation.mutateAsync,
    submitWeeklyFlag: submitFlagMutation.mutateAsync,
    connectGithub: connectGithubMutation.mutateAsync,
    reviewPullRequest: reviewPullRequestMutation.mutateAsync,
    reviewPullRequestPending: reviewPullRequestMutation.isPending,
    reviewResult: reviewPullRequestMutation.data?.result,
    startCheckout: checkoutMutation.mutateAsync,
    startCheckoutPending: checkoutMutation.isPending,
    syncCheckout: syncCheckoutMutation.mutateAsync,
    syncCheckoutPending: syncCheckoutMutation.isPending,
    openBillingPortal: portalMutation.mutateAsync,
    openBillingPortalPending: portalMutation.isPending,
  };
};
