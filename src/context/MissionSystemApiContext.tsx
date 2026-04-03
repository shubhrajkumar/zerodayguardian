import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PyApiError, getPyApiUserMessage, pyGetJson, pyPostJson } from "@/lib/pyApiClient";
import { useAuth } from "@/context/AuthContext";
import { getStoredAccessToken } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";

export type MissionActionType =
  | "program_day_complete"
  | "sandbox_mission_complete"
  | "learn_track_started"
  | "learn_track_completed"
  | "mentor_open"
  | "recommendation_reviewed"
  | "command_center_opened"
  | "mission_hidden_discovered"
  | "mission_hidden_completed"
  | "insight_shared"
  | "referral_invite_sent"
  | "referral_signup_completed"
  | "notification_opened"
  | "notification_preferences_updated";

type MissionTask = {
  id: string;
  title: string;
  detail: string;
  reward: number;
  actionType: MissionActionType;
  completed: boolean;
  route?: string | null;
  ctaLabel?: string | null;
};

type MissionChallenge = {
  id: string;
  title: string;
  detail: string;
  reward: number;
  goal: number;
  progress: number;
  completed: boolean;
};

type MissionReward = {
  id: string;
  label: string;
  detail: string;
  xp: number;
  tone: "xp" | "streak" | "badge";
  awardedAt: number;
};

type MissionBadge = {
  id: string;
  title: string;
  detail: string;
  icon: "flame" | "crown" | "shield" | "spark";
  earned?: boolean;
};

type UnlockGate = "advanced_labs" | "elite_program" | "intel_tools" | "shadow_challenge";

type HiddenChallenge = {
  id: string;
  title: string;
  detail: string;
  reward: number;
  discovered: boolean;
  unlocked: boolean;
  completed: boolean;
};

type RewardPulse = {
  id: string;
  title: string;
  detail: string;
  xp: number;
  tone: "xp" | "streak" | "badge";
  createdAt: number;
};

type MissionHook = {
  title: string;
  detail: string;
  ctaLabel: string;
  target: "task" | "challenge" | "hidden" | "return";
  taskId?: string;
  route?: string | null;
};

type MissionRail = {
  id: string;
  level: string;
  title: string;
  objective: string;
  mode: string;
  payoff: string;
  progressLabel: string;
  route: string;
};

type MissionQuickAction = {
  id: string;
  title: string;
  detail: string;
  cta: string;
  route: string;
  actionType: MissionActionType;
  status: string;
};

type MissionReferral = {
  code: string;
  inviteCount: number;
  signupCount: number;
  conversionCount: number;
  rewardPoints: number;
  shareUrl: string;
  headline: string;
  nextReward: string;
  conversionRate: number;
};

type MissionInsightCard = {
  id: string;
  title: string;
  description: string;
  cta: string;
  shareText: string;
  seoTitle: string;
  seoDescription: string;
  slug: string;
  trend: string;
  proofPoints: string[];
};

type MissionNotificationSuggestion = {
  id: string;
  channel: string;
  title: string;
  detail: string;
  sendWindow: string;
  enabled: boolean;
  priority: string;
  trigger: string;
};

type MissionNotificationPreferences = {
  emailEnabled: boolean;
  pushEnabled: boolean;
  streakAlerts: boolean;
  referralAlerts: boolean;
  digestEnabled: boolean;
  preferredWindow: string;
  quietHours: string;
  timezone: string;
};

type MissionDebugState = {
  requestId: string;
  generatedAt: string;
  autoRetryReady: boolean;
  validationState: string;
  errorCapture: string;
  warnings: string[];
  recentEvents: Array<{
    id: string;
    stage: string;
    level: string;
    message: string;
    createdAt?: string | null;
    payload: Record<string, unknown>;
  }>;
};

type MissionControlPayload = {
  tasks: Array<{
    id: string;
    title: string;
    detail: string;
    reward: number;
    action_type: MissionActionType;
    completed: boolean;
    route?: string | null;
    cta_label?: string | null;
  }>;
  challenge: MissionChallenge;
  streak: number;
  best_streak: number;
  total_completed: number;
  total_points: number;
  momentum: number;
  completed_days: number;
  completed_sandbox_labs: number;
  recent_rewards: Array<{
    id: string;
    label: string;
    detail: string;
    xp: number;
    tone: RewardPulse["tone"];
    awarded_at: number;
  }>;
  badges: MissionBadge[];
  unlocked_gates: Record<UnlockGate, boolean>;
  hidden_challenges: HiddenChallenge[];
  streak_reminder: string;
  curiosity_trigger: string;
  next_mission_hook: {
    title: string;
    detail: string;
    cta_label: string;
    target: MissionHook["target"];
    task_id?: string | null;
    route?: string | null;
  };
  recommendations: Array<{ title: string; reason: string; action: string; priority?: number }>;
  rails: Array<{
    id: string;
    level: string;
    title: string;
    objective: string;
    mode: string;
    payoff: string;
    progress_label: string;
    route: string;
  }>;
  quick_actions: Array<{
    id: string;
    title: string;
    detail: string;
    cta: string;
    route: string;
    action_type: MissionActionType;
    status: string;
  }>;
  referral: {
    code: string;
    invite_count: number;
    signup_count: number;
    conversion_count: number;
    reward_points: number;
    share_url: string;
    headline: string;
    next_reward: string;
    conversion_rate: number;
  };
  shareable_insights: Array<{
    id: string;
    title: string;
    description: string;
    cta: string;
    share_text: string;
    seo_title: string;
    seo_description: string;
    slug: string;
    trend: string;
    proof_points: string[];
  }>;
  smart_notifications: Array<{
    id: string;
    channel: string;
    title: string;
    detail: string;
    send_window: string;
    enabled: boolean;
    priority: string;
    trigger: string;
  }>;
  notification_preferences: {
    email_enabled: boolean;
    push_enabled: boolean;
    streak_alerts: boolean;
    referral_alerts: boolean;
    digest_enabled: boolean;
    preferred_window: string;
    quiet_hours: string;
    timezone: string;
  };
  debug: {
    request_id: string;
    generated_at: string;
    auto_retry_ready: boolean;
    validation_state: string;
    error_capture: string;
    warnings: string[];
    recent_events: Array<{
      id: string;
      stage: string;
      level: string;
      message: string;
      created_at?: string | null;
      payload: Record<string, unknown>;
    }>;
  };
};

type MissionActionResponse = {
  ok: boolean;
  action_type: MissionActionType;
  points_awarded: number;
  reward?: {
    id: string;
    label: string;
    detail: string;
    xp: number;
    tone: RewardPulse["tone"];
    awarded_at: number;
  } | null;
  mission_control: MissionControlPayload;
};

type MissionSystemContextValue = {
  tasks: MissionTask[];
  challenge: MissionChallenge;
  streak: number;
  bestStreak: number;
  totalCompleted: number;
  totalPoints: number;
  momentum: number;
  recentRewards: MissionReward[];
  badges: MissionBadge[];
  unlockedGates: Record<UnlockGate, boolean>;
  hiddenChallenges: HiddenChallenge[];
  streakReminder: string;
  curiosityTrigger: string;
  nextMissionHook: MissionHook;
  activeReward: RewardPulse | null;
  rails: MissionRail[];
  quickActions: MissionQuickAction[];
  recommendations: Array<{ title: string; reason: string; action: string; priority?: number }>;
  completedDays: number;
  completedSandboxLabs: number;
  referral: MissionReferral;
  shareableInsights: MissionInsightCard[];
  smartNotifications: MissionNotificationSuggestion[];
  notificationPreferences: MissionNotificationPreferences;
  debug: MissionDebugState;
  error: string;
  loading: boolean;
  refreshMissionData: () => Promise<void>;
  recordAction: (actionType: MissionActionType, options?: { target?: string; metadata?: Record<string, unknown> }) => Promise<void>;
  updateNotificationPreferences: (payload: Partial<MissionNotificationPreferences>) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  discoverHiddenChallenge: (challengeId: string) => Promise<void>;
  completeHiddenChallenge: (challengeId: string) => Promise<void>;
  dismissReward: () => void;
};

const MissionSystemContext = createContext<MissionSystemContextValue | null>(null);

const emptyPayload: MissionControlPayload = {
  tasks: [],
  challenge: { id: "daily-combo", title: "Momentum Combo", detail: "Complete meaningful actions today.", reward: 0, goal: 3, progress: 0, completed: false },
  streak: 0,
  best_streak: 0,
  total_completed: 0,
  total_points: 0,
  momentum: 0,
  completed_days: 0,
  completed_sandbox_labs: 0,
  recent_rewards: [],
  badges: [],
  unlocked_gates: { advanced_labs: false, elite_program: false, intel_tools: false, shadow_challenge: false },
  hidden_challenges: [],
  streak_reminder: "Sign in to unlock mission tracking.",
  curiosity_trigger: "Complete one real action to unlock recommendations.",
  next_mission_hook: { title: "Sign in", detail: "Authenticate to start the real mission loop.", cta_label: "Open program", target: "return", route: "/program" },
  recommendations: [],
  rails: [],
  quick_actions: [],
  referral: {
    code: "",
    invite_count: 0,
    signup_count: 0,
    conversion_count: 0,
    reward_points: 0,
    share_url: "/auth",
    headline: "Invite a teammate once your progress is visible.",
    next_reward: "Referral unlocks appear after your first invite.",
    conversion_rate: 0,
  },
  shareable_insights: [],
  smart_notifications: [],
  notification_preferences: {
    email_enabled: true,
    push_enabled: true,
    streak_alerts: true,
    referral_alerts: true,
    digest_enabled: true,
    preferred_window: "18:00-20:00",
    quiet_hours: "22:00-07:00",
    timezone: "UTC",
  },
  debug: {
    request_id: "",
    generated_at: "",
    auto_retry_ready: true,
    validation_state: "strict",
    error_capture: "enabled",
    warnings: [],
    recent_events: [],
  },
};

export const MissionSystemProvider = ({ children }: { children: ReactNode }) => {
  const { authState, isAuthenticated, user } = useAuth();
  const [missionData, setMissionData] = useState<MissionControlPayload>(emptyPayload);
  const [activeReward, setActiveReward] = useState<RewardPulse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ensurePyUser = useCallback(async () => {
    if (!user?.email) return;
    await pyPostJson("/users", {
      email: user.email,
      name: user.name || user.email,
      external_id: user.id,
    });
  }, [user]);

  const refreshMissionData = useCallback(async () => {
    if (authState === "loading") return;
    if (!isAuthenticated || !user || !getStoredAccessToken()) {
      setMissionData(emptyPayload);
      setError("");
      return;
    }
    setLoading(true);
    try {
      const payload = await pyGetJson<MissionControlPayload>("/mission-control");
      setMissionData(payload);
      setError("");
    } catch (error) {
      const err = error as PyApiError;
      if (err.status === 404) {
        await ensurePyUser();
        const payload = await pyGetJson<MissionControlPayload>("/mission-control");
        setMissionData(payload);
        setError("");
        return;
      }
      if (err.status === 401 || err.status === 403) {
        setMissionData(emptyPayload);
        setError("");
        return;
      }
      setError(getPyApiUserMessage(err, "We couldn't load your mission dashboard right now."));
    } finally {
      setLoading(false);
    }
  }, [authState, ensurePyUser, isAuthenticated, user]);

  useEffect(() => {
    refreshMissionData().catch(() => undefined);
  }, [refreshMissionData]);

  const recordAction = useCallback(
    async (actionType: MissionActionType, options?: { target?: string; metadata?: Record<string, unknown> }) => {
      if (!isAuthenticated || !user || !getStoredAccessToken()) return;
      try {
        const response = await pyPostJson<MissionActionResponse>("/mission-control/actions", {
          action_type: actionType,
          target: options?.target || actionType,
          metadata: options?.metadata || {},
        });
        setMissionData(response.mission_control);
        if (response.reward) {
          setActiveReward({
            id: response.reward.id,
            title: response.reward.label,
            detail: response.reward.detail,
            xp: response.reward.xp,
            tone: response.reward.tone,
            createdAt: response.reward.awarded_at,
          });
        }
        if (!response.ok) {
          const message = response.mission_control?.debug?.warnings?.[0] || "That action did not save cleanly. You can retry in a moment.";
          setError(message);
          toast({ title: "Action needs a retry", description: message });
        } else {
          setError("");
        }
      } catch {
        setError("We couldn't save that action right now. Your dashboard was refreshed so you can continue safely.");
        await refreshMissionData();
      }
    },
    [isAuthenticated, refreshMissionData, user]
  );

  const completeTask = useCallback(async (taskId: string) => {
    const task = missionData.tasks.find((item) => item.id === taskId);
    if (!task) return;
    await recordAction(task.action_type, {
      target: task.action_type,
      metadata: {
        title: task.title,
        detail: `+${task.reward} XP awarded for ${task.title.toLowerCase()}.`,
        task_id: task.id,
      },
    });
  }, [missionData.tasks, recordAction]);

  const discoverHiddenChallenge = useCallback(async (challengeId: string) => {
    const challenge = missionData.hidden_challenges.find((item) => item.id === challengeId);
    await recordAction("mission_hidden_discovered", {
      target: challengeId,
      metadata: {
        title: challenge?.title || "Hidden Challenge",
        challenge_id: challengeId,
      },
    });
  }, [missionData.hidden_challenges, recordAction]);

  const completeHiddenChallenge = useCallback(async (challengeId: string) => {
    const challenge = missionData.hidden_challenges.find((item) => item.id === challengeId);
    await recordAction("mission_hidden_completed", {
      target: challengeId,
      metadata: {
        title: challenge?.title || "Hidden Challenge",
        detail: `+${challenge?.reward || 45} XP hidden mission reward.`,
        reward: challenge?.reward || 45,
        challenge_id: challengeId,
      },
    });
  }, [missionData.hidden_challenges, recordAction]);

  const dismissReward = useCallback(() => setActiveReward(null), []);

  const updateNotificationPreferences = useCallback(async (payload: Partial<MissionNotificationPreferences>) => {
    if (!isAuthenticated || !user) return;
    try {
      const response = await pyPostJson<MissionControlPayload>("/mission-control/preferences", {
        email_enabled: payload.emailEnabled,
        push_enabled: payload.pushEnabled,
        streak_alerts: payload.streakAlerts,
        referral_alerts: payload.referralAlerts,
        digest_enabled: payload.digestEnabled,
        preferred_window: payload.preferredWindow,
        quiet_hours: payload.quietHours,
        timezone: payload.timezone,
      });
      setMissionData(response);
      setError(response.debug?.warnings?.[0] || "");
    } catch (err) {
      const message = getPyApiUserMessage(err, "We couldn't update those notification settings right now.");
      setError(message);
      toast({ title: "Settings not updated", description: message });
    }
  }, [isAuthenticated, user]);

  const value = useMemo<MissionSystemContextValue>(() => ({
    tasks: missionData.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      detail: task.detail,
      reward: task.reward,
      actionType: task.action_type,
      completed: task.completed,
      route: task.route,
      ctaLabel: task.cta_label,
    })),
    challenge: missionData.challenge,
    streak: missionData.streak,
    bestStreak: missionData.best_streak,
    totalCompleted: missionData.total_completed,
    totalPoints: missionData.total_points,
    momentum: missionData.momentum,
    recentRewards: missionData.recent_rewards.map((reward) => ({
      id: reward.id,
      label: reward.label,
      detail: reward.detail,
      xp: reward.xp,
      tone: reward.tone,
      awardedAt: reward.awarded_at,
    })),
    badges: missionData.badges,
    unlockedGates: missionData.unlocked_gates,
    hiddenChallenges: missionData.hidden_challenges,
    streakReminder: missionData.streak_reminder,
    curiosityTrigger: missionData.curiosity_trigger,
    nextMissionHook: {
      title: missionData.next_mission_hook.title,
      detail: missionData.next_mission_hook.detail,
      ctaLabel: missionData.next_mission_hook.cta_label,
      target: missionData.next_mission_hook.target,
      taskId: missionData.next_mission_hook.task_id || undefined,
      route: missionData.next_mission_hook.route,
    },
    activeReward,
    rails: missionData.rails.map((rail) => ({
      id: rail.id,
      level: rail.level,
      title: rail.title,
      objective: rail.objective,
      mode: rail.mode,
      payoff: rail.payoff,
      progressLabel: rail.progress_label,
      route: rail.route,
    })),
    quickActions: missionData.quick_actions.map((action) => ({
      id: action.id,
      title: action.title,
      detail: action.detail,
      cta: action.cta,
      route: action.route,
      actionType: action.action_type,
      status: action.status,
    })),
    recommendations: missionData.recommendations,
    completedDays: missionData.completed_days,
    completedSandboxLabs: missionData.completed_sandbox_labs,
    referral: {
      code: missionData.referral.code,
      inviteCount: missionData.referral.invite_count,
      signupCount: missionData.referral.signup_count,
      conversionCount: missionData.referral.conversion_count,
      rewardPoints: missionData.referral.reward_points,
      shareUrl: missionData.referral.share_url,
      headline: missionData.referral.headline,
      nextReward: missionData.referral.next_reward,
      conversionRate: missionData.referral.conversion_rate,
    },
    shareableInsights: missionData.shareable_insights.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      cta: item.cta,
      shareText: item.share_text,
      seoTitle: item.seo_title,
      seoDescription: item.seo_description,
      slug: item.slug,
      trend: item.trend,
      proofPoints: item.proof_points,
    })),
    smartNotifications: missionData.smart_notifications.map((item) => ({
      id: item.id,
      channel: item.channel,
      title: item.title,
      detail: item.detail,
      sendWindow: item.send_window,
      enabled: item.enabled,
      priority: item.priority,
      trigger: item.trigger,
    })),
    notificationPreferences: {
      emailEnabled: missionData.notification_preferences.email_enabled,
      pushEnabled: missionData.notification_preferences.push_enabled,
      streakAlerts: missionData.notification_preferences.streak_alerts,
      referralAlerts: missionData.notification_preferences.referral_alerts,
      digestEnabled: missionData.notification_preferences.digest_enabled,
      preferredWindow: missionData.notification_preferences.preferred_window,
      quietHours: missionData.notification_preferences.quiet_hours,
      timezone: missionData.notification_preferences.timezone,
    },
    debug: {
      requestId: missionData.debug.request_id,
      generatedAt: missionData.debug.generated_at,
      autoRetryReady: missionData.debug.auto_retry_ready,
      validationState: missionData.debug.validation_state,
      errorCapture: missionData.debug.error_capture,
      warnings: missionData.debug.warnings,
      recentEvents: missionData.debug.recent_events.map((item) => ({
        id: item.id,
        stage: item.stage,
        level: item.level,
        message: item.message,
        createdAt: item.created_at,
        payload: item.payload,
      })),
    },
    error,
    loading,
    refreshMissionData,
    recordAction,
    updateNotificationPreferences,
    completeTask,
    discoverHiddenChallenge,
    completeHiddenChallenge,
    dismissReward,
  }), [activeReward, completeHiddenChallenge, completeTask, dismissReward, error, loading, missionData, recordAction, refreshMissionData, discoverHiddenChallenge, updateNotificationPreferences]);

  return <MissionSystemContext.Provider value={value}>{children}</MissionSystemContext.Provider>;
};

export const useMissionSystem = () => {
  const context = useContext(MissionSystemContext);
  if (!context) {
    throw new Error("useMissionSystem must be used within MissionSystemProvider");
  }
  return context;
};
