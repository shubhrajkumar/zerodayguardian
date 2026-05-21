import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BellRing, CheckCircle2, Copy, Flame, Gift, PlayCircle, Radar, Rocket, Send, Share2, Sparkles, Target, TerminalSquare, Trophy, Wallet } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PlatformHero from "@/components/platform/PlatformHero";
import DailyMissionLoop from "@/components/platform/DailyMissionLoop";
import MissionRail from "@/components/platform/MissionRail";
import QuizWidget from "@/components/platform/QuizWidget";
import { pyGetJson } from "@/lib/pyApiClient";
import { useMissionSystem } from "@/context/MissionSystemApiContext";
import { useAuth } from "@/context/AuthContext";
import { useGamificationSystem } from "@/lib/gamificationSystem";
import { toast } from "@/hooks/use-toast";
import Seo from "@/components/Seo";
import { useMonthlyReferralLeaderboard, useReferralRecord } from "@/hooks/useGrowthFeatures";
import { usePlatformGrowthOps } from "@/hooks/usePlatformGrowthOps";
import { incrementReferralInvite } from "@/lib/firestoreGrowth";

type LabsOverviewItem = {
  day: number;
  title: string;
  unlocked: boolean;
  completed: boolean;
  xp_earned: number;
  score: number;
};

type LabsOverviewResponse = {
  items: LabsOverviewItem[];
  recommended_day: number;
  streak_message: string;
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { authState, user } = useAuth();
  const {
    streak,
    totalPoints,
    completedSandboxLabs,
    nextMissionHook,
    quickActions,
    recommendations,
    curiosityTrigger,
    recordAction,
    referral,
    shareableInsights,
    smartNotifications,
    notificationPreferences,
    updateNotificationPreferences,
    debug,
    error: missionError,
  } = useMissionSystem();
  const { data: referralRecord } = useReferralRecord();
  const { data: referralLeaderboard } = useMonthlyReferralLeaderboard();
  const {
    data: growthOverview,
    activeCertification,
    enablePush,
    sendTestPush,
    updateDigest,
    sendDigestNow,
    useStreakFreeze: reserveStreakFreeze,
    enrollCertification,
    updateMilestone,
    joinWeeklyCtf,
    submitWeeklyFlag,
    connectGithub,
    reviewPullRequest,
    reviewResult,
    startCheckout,
    syncCheckout,
    openBillingPortal,
  } = usePlatformGrowthOps();
  const [overview, setOverview] = useState<LabsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [digestEmailDraft, setDigestEmailDraft] = useState("");
  const [ctfFlag, setCtfFlag] = useState("");
  const [githubOwner, setGithubOwner] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubBranch, setGithubBranch] = useState("main");
  const [githubPr, setGithubPr] = useState("1");
  const gamification = useGamificationSystem(user?.id, user?.name || user?.email);

  useEffect(() => {
    if (authState === "loading") {
      setLoading(true);
      return;
    }
    if (authState !== "authenticated" || !user?.id) {
      setOverview(null);
      setOverviewError("");
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    pyGetJson<LabsOverviewResponse>("/labs/overview")
      .then((payload) => {
        if (!active) return;
        setOverview(payload);
        setOverviewError("");
      })
      .catch((error) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "We couldn't sync the lab overview.";
        setOverviewError(message);
        toast({ title: "Lab overview degraded", description: message });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authState, user?.id]);

  useEffect(() => {
    if (!growthOverview) return;
    setDigestEmailDraft(growthOverview.digest.email || "");
    setGithubOwner(growthOverview.github.owner || "");
    setGithubRepo(growthOverview.github.repo || "");
    setGithubBranch(growthOverview.github.defaultBranch || "main");
  }, [growthOverview]);

  useEffect(() => {
    const checkoutState = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    if (checkoutState !== "success" || !sessionId) return;
    syncCheckout(sessionId)
      .then(() => {
        toast({ title: "Subscription synced", description: "Your plan status has been refreshed." });
        const next = new URLSearchParams(searchParams);
        next.delete("checkout");
        next.delete("session_id");
        setSearchParams(next, { replace: true });
      })
      .catch((error) => {
        toast({ title: "Subscription sync failed", description: error instanceof Error ? error.message : "Please retry." });
      });
  }, [searchParams, setSearchParams, syncCheckout]);

  const completedDays = overview?.items.filter((item) => item.completed).length || 0;
  const nextDay = overview?.recommended_day || 1;
  const totalXp = overview?.items.reduce((sum, item) => sum + Number(item.xp_earned || 0), 0) || 0;
  const completionPct = useMemo(() => {
    if (!overview?.items?.length) return 0;
    return Math.round((completedDays / overview.items.length) * 100);
  }, [overview, completedDays]);
  const recentRuns = useMemo(() => (overview?.items || []).filter((item) => item.completed).slice(-5).reverse(), [overview]);
  const primaryNotification = smartNotifications[0];
  const [timeLeft, setTimeLeft] = useState("00:00:00");

  const handleGamifiedMissionComplete = async (scope: "daily" | "weekly", missionId: string) => {
    const mission =
      scope === "daily"
        ? gamification.snapshot.dailyMissions.find((item) => item.id === missionId)
        : gamification.snapshot.weeklyMissions.find((item) => item.id === missionId);
    await gamification.completeMission(scope, missionId);
    try {
      const actionType =
        mission?.kind === "cve_read"
          ? "recommendation_reviewed"
          : mission?.kind === "ctf"
            ? "sandbox_mission_complete"
            : mission?.kind === "port_scan"
              ? "command_center_opened"
              : "sandbox_mission_complete";
      await recordAction(actionType, {
        target: mission?.title || missionId,
        metadata: {
          mission_scope: scope,
          mission_id: missionId,
          mission_title: mission?.title || missionId,
          route: mission?.route || null,
        },
      });
    } catch (error) {
      toast({
        title: "Mission sync partially degraded",
        description: error instanceof Error ? error.message : "The UI stayed stable and your local reward state is still visible.",
      });
    }
  };

  const handleQuizAnswer = async (questionId: string, optionId: string) => {
    const answer = await gamification.submitQuizAnswer(questionId, optionId);
    if (answer?.correct) {
      recordAction("recommendation_reviewed", {
        target: questionId,
        metadata: {
          quiz_question_id: questionId,
          correct: true,
          points_awarded: answer.pointsAwarded,
        },
      }).catch(() => undefined);
    }
    return answer;
  };

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0);
      const diff = Math.max(0, tomorrow.getTime() - now.getTime());
      const hours = Math.floor(diff / 3_600_000).toString().padStart(2, "0");
      const minutes = Math.floor((diff % 3_600_000) / 60_000).toString().padStart(2, "0");
      const seconds = Math.floor((diff % 60_000) / 1000).toString().padStart(2, "0");
      setTimeLeft(`${hours}:${minutes}:${seconds}`);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const copyToClipboard = async (text: string, successTitle: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: successTitle });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard access was blocked in this browser." });
    }
  };

  const handleEnablePush = async () => {
    if (!growthOverview?.push.publicKey) {
      toast({ title: "Push not configured", description: "Add VAPID keys on the backend first." });
      return;
    }
    try {
      await enablePush(growthOverview.push.publicKey);
      toast({ title: "Push enabled", description: "This browser can now receive live operator alerts." });
    } catch (error) {
      toast({ title: "Push setup failed", description: error instanceof Error ? error.message : "Please retry." });
    }
  };

  return (
    <div className="container grid-bg mx-auto px-4 py-12 page-shell">
      <Seo
        title="Growth Dashboard | ZeroDay Guardian"
        description="Track real progress, referral momentum, notifications, streak pressure, and next-level cybersecurity milestones."
        path="/dashboard"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "ZeroDay Guardian Dashboard",
          description: "Real-time cybersecurity progress dashboard with referrals, achievements, and mission flow.",
        }}
      />
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="cyber-card fadeInUp scanLine rounded-[40px] p-1">
          <PlatformHero
            eyebrow="Mission Dashboard"
            title={
              <>
                <span className="glow-text">One command view for </span><span className="brand-gradient-text-animated">progress, missions, and next execution</span>
              </>
            }
            description="A premium operator dashboard: live progress at the top, one primary action in focus, and structured routes into the day program, sandbox labs, and ZORVIX."
            pills={[
              `${completedDays}/60 complete`,
              `Next day ${nextDay}`,
              `${completionPct}% progress`,
              `${totalPoints} XP`,
            ]}
            actions={
              <button
                type="button"
                className="cyber-btn terminal-font"
                onClick={() => {
                  recordAction("command_center_opened", { target: "dashboard_resume" }).catch(() => undefined);
                  navigate(`/program/day/${nextDay}`);
                }}
                disabled={loading}
              >
                <PlayCircle className="h-4 w-4" />
                Resume Day {nextDay}
              </button>
            }
            aside={
              <div className="space-y-3 text-sm text-slate-200">
                <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Live status</p>
                <p className="text-slate-100">{overview?.streak_message || "Validated completion unlocks the next day automatically."}</p>
                <p className="text-slate-400">{curiosityTrigger}</p>
              </div>
            }
          />
        </div>

        <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="premium-spotlight-shell cyber-card">
            <div className="premium-spotlight-shell__header">
              <div>
                <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-400">Operator Pulse</p>
                <h2 className="glow-text mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">A dashboard that makes the next mission irresistible</h2>
              </div>
              <div className="cyber-badge">
                <Sparkles className="h-4 w-4" />
                Real-time state
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                { label: "Next unlock", value: `Day ${nextDay}`, detail: "The next validated day is already queued." },
                { label: "XP velocity", value: `${totalXp} earned`, detail: "Backend-tracked XP makes each session feel cumulative." },
                { label: "Streak pressure", value: `${streak} days`, detail: "Momentum is visible, so returning tomorrow has weight." },
              ].map((item) => (
                <div key={item.label} className="premium-signal-tile cyber-card rounded-[24px] p-4">
                  <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">{item.value}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300/74">{item.detail}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="premium-briefing-stack">
            <div className="premium-briefing-stack__card premium-briefing-stack__card--accent cyber-card">
              <p className="terminal-font text-[11px] uppercase tracking-[0.2em] text-slate-400">Mission cadence</p>
              <p className="mt-3 text-lg font-semibold text-white">{nextMissionHook.title}</p>
              <p className="mt-3 text-sm leading-6 text-slate-300/78">{nextMissionHook.detail}</p>
              {nextMissionHook.route ? (
                <button
                  type="button"
                  className="cyber-btn terminal-font mt-5"
                  onClick={() => {
                    recordAction("command_center_opened", { target: "dashboard_spotlight_action" }).catch(() => undefined);
                    navigate(nextMissionHook.route as string);
                  }}
                >
                  <ArrowRight className="h-4 w-4" />
                  {nextMissionHook.ctaLabel}
                </button>
              ) : null}
            </div>
            <div className="premium-briefing-stack__card cyber-card">
              <p className="terminal-font text-[11px] uppercase tracking-[0.2em] text-slate-400">Recent wins</p>
              <div className="mt-4 space-y-3">
                {(recentRuns.length ? recentRuns : [{ day: nextDay, title: "Next day ready", xp_earned: 0, score: 0 }]).map((item) => (
                  <div key={`${item.day}-${item.title}`} className="premium-flow-chip">
                    <span>{item.day}</span>
                    <p>{`${item.title} · ${item.xp_earned} XP · ${item.score} score`}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Progress", value: `${completedDays}/60`, icon: CheckCircle2 },
            { label: "Total XP", value: `${totalXp}`, icon: Target },
            { label: "Mission Streak", value: `${streak} days`, icon: Flame },
          ].map((card) => (
            <div key={card.label} className="premium-grid-card cyber-card">
              <card.icon className="h-5 w-5 text-sky-200/90" />
              <p className="terminal-font mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">{card.value}</p>
            </div>
          ))}
        </section>

        {missionError ? (
          <section className="cyber-card rounded-[24px] border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            {missionError}
          </section>
        ) : null}

        {overviewError ? (
          <section className="cyber-card rounded-[24px] border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            {overviewError}
          </section>
        ) : null}

        <DailyMissionLoop
          snapshot={gamification.snapshot}
          loading={gamification.loading || loading}
          error={gamification.error}
          latestReward={gamification.latestReward}
          onCompleteMission={handleGamifiedMissionComplete}
          onDismissReward={gamification.clearLatestReward}
          onRefresh={gamification.refresh}
        />

        <QuizWidget
          snapshot={gamification.snapshot}
          loading={gamification.loading}
          error={gamification.error}
          onAnswer={handleQuizAnswer}
        />

        <MissionRail />

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="premium-section-card cyber-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Referral Engine</p>
                <h2 className="glow-text mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Momentum that recruits the next operator</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300/78">{referral.headline}</p>
              </div>
              <button
                type="button"
                className="cyber-btn terminal-font"
                onClick={() => {
                  recordAction("referral_invite_sent", {
                    target: referral.code,
                    metadata: { title: "Referral invite sent", count: 1, referral_code: referral.code },
                  }).catch(() => undefined);
                  if (referralRecord?.userId) {
                    incrementReferralInvite(referralRecord.userId).catch(() => undefined);
                  }
                  copyToClipboard(`${window.location.origin}${referral.shareUrl}`, "Referral link copied");
                }}
              >
                <Gift className="h-4 w-4" />
                Copy invite link
              </button>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              {[
                { label: "Referral code", value: referral.code },
                { label: "Invites sent", value: `${referral.inviteCount}` },
                { label: "Conversions", value: `${referral.conversionCount}` },
                { label: "Reward bank", value: `${referral.rewardPoints} XP` },
              ].map((item) => (
                <div key={item.label} className="premium-signal-tile cyber-card rounded-[24px] p-4">
                  <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="cyber-card mt-5 rounded-[24px] p-4">
              <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-slate-400">Next unlock</p>
              <p className="mt-2 text-sm font-semibold text-white">{referral.nextReward}</p>
              <p className="mt-2 text-sm text-slate-300/76">Conversion rate: {referral.conversionRate}%</p>
              <p className="mt-2 text-xs text-slate-500">Live Firestore code: {referralRecord?.code || referral.code}</p>
            </div>
          </article>

          <article className="premium-section-card cyber-card">
            <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Shareable Insights</p>
            <div className="mt-4 grid gap-3">
              {shareableInsights.map((insight) => (
                <div key={insight.id} className="premium-nav-row cyber-card rounded-3xl">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{insight.title}</p>
                      <span className="cyber-badge">{insight.trend}</span>
                    </div>
                    <p className="text-xs leading-5 text-slate-400">{insight.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {insight.proofPoints.map((point) => (
                        <span key={point} className="instant-feedback-chip">{point}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="cyber-btn terminal-font"
                      onClick={() => {
                        recordAction("insight_shared", {
                          target: insight.slug,
                          metadata: { title: insight.title, insight_key: insight.slug, detail: insight.description },
                        }).catch(() => undefined);
                        copyToClipboard(insight.shareText, "Insight copied");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                      {insight.cta}
                    </button>
                    <button
                      type="button"
                      className="premium-nav-row rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200"
                      onClick={() => copyToClipboard(`${insight.seoTitle}\n${insight.seoDescription}`, "SEO-ready share copy copied")}
                    >
                      <Share2 className="h-4 w-4" />
                      SEO-ready snippet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="premium-section-card cyber-card">
            <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Primary Action</p>
            <h2 className="glow-text mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">{nextMissionHook.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300/78">{nextMissionHook.detail}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                { label: "Sandbox Clears", value: `${completedSandboxLabs}` },
                { label: "Program Completion", value: `${completionPct}%` },
                { label: "Current Streak", value: `${streak} days` },
              ].map((item) => (
                <div key={item.label} className="cyber-card rounded-2xl p-4">
                  <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-3 text-xl font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
            {nextMissionHook.route ? (
              <button
                type="button"
                className="cyber-btn terminal-font mt-5"
                onClick={() => {
                  recordAction("command_center_opened", { target: "dashboard_primary_action" }).catch(() => undefined);
                  navigate(nextMissionHook.route as string);
                }}
              >
                <ArrowRight className="h-4 w-4" />
                {nextMissionHook.ctaLabel}
              </button>
            ) : null}
          </article>

          <article className="premium-section-card cyber-card">
            <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Action Queue</p>
            <div className="mt-4 grid gap-3">
              {(quickActions.length
                ? quickActions
                : [
                    { id: "program", title: "Program", detail: "Validated daily progression.", route: "/program", cta: "Open day lab", status: "ready" },
                    { id: "lab", title: "Labs", detail: "Sandbox drills and mission scoring.", route: "/lab", cta: "Launch mission", status: "ready" },
                    { id: "mentor", title: "ZORVIX", detail: "Open the mentor workspace.", route: "/assistant", cta: "Open mentor", status: "ready" },
                  ]
              ).slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="premium-nav-row cyber-card rounded-3xl"
                  onClick={() => navigate(item.route)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <span className={`terminal-font rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
                        item.status === "completed" ? "border border-emerald-300/18 bg-emerald-500/10 text-emerald-100" : "border border-slate-600/70 bg-slate-900/70 text-slate-200"
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </button>
              ))}
            </div>
            <div className="cyber-card mt-4 rounded-2xl p-4">
              <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-slate-400">Recommendation signal</p>
              <p className="mt-2 text-sm font-semibold text-white">{recommendations[0]?.title || "Adaptive guidance active"}</p>
              <p className="mt-1 text-sm text-slate-300/76">{recommendations[0]?.action || "Open learn or ZORVIX to refresh the next-best action for today."}</p>
            </div>
            <div className="cyber-card mt-4 rounded-2xl p-4">
              <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-slate-400">Daily mission reset</p>
              <p className="mt-2 text-2xl font-semibold text-white">{timeLeft}</p>
              <p className="mt-1 text-sm text-slate-300/76">Use the remaining window to lock streak protection and claim pending rewards.</p>
            </div>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="premium-section-card premium-heat-panel cyber-card scanLine">
            <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Consistency Grid</p>
            <div className="mt-5 grid gap-3 md:grid-cols-10">
              {Array.from({ length: 20 }, (_, index) => {
                const active = index < Math.max(4, Math.min(20, completedDays + completedSandboxLabs));
                return (
                  <div key={index} className={`premium-heat-cell ${active ? "premium-heat-cell--active" : ""}`}>
                    <span>{index + 1}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300/76">
              Visible consistency makes the dashboard feel alive. Each validated day and sandbox clear brightens the board and reinforces momentum.
            </p>
          </article>

          <article className="premium-section-card cyber-card">
            <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Fast Launch</p>
            <div className="mt-4 grid gap-3">
              {[
                { icon: PlayCircle, title: `Resume Day ${nextDay}`, copy: "Jump straight back into the current guided module.", action: () => navigate(`/program/day/${nextDay}`) },
                { icon: TerminalSquare, title: "Open Sandbox Range", copy: "Switch into hands-on mission execution with realistic outputs.", action: () => navigate("/lab") },
                { icon: Sparkles, title: "Ask ZORVIX", copy: "Pull adaptive guidance, recovery help, and next-step recommendations.", action: () => navigate("/assistant") },
              ].map((item) => (
                <button key={item.title} type="button" className="premium-nav-row cyber-card rounded-3xl" onClick={item.action}>
                  <div className="flex items-start gap-3">
                    <item.icon className="mt-0.5 h-4 w-4 text-sky-200/90" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{item.copy}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </button>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="premium-section-card cyber-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Smart Notifications</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">High-pressure reminders without noisy spam</h2>
              </div>
              <BellRing className="h-5 w-5 text-sky-200/90" />
            </div>
            {primaryNotification ? (
              <div className="cyber-card mt-5 rounded-[24px] p-4">
                <p className="text-sm font-semibold text-white">{primaryNotification.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300/76">{primaryNotification.detail}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-cyan-100/72">{primaryNotification.channel} · {primaryNotification.sendWindow}</p>
              </div>
            ) : null}
            <div className="mt-4 grid gap-3">
              {smartNotifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="premium-nav-row cyber-card rounded-3xl"
                  onClick={() => recordAction("notification_opened", { target: item.id, metadata: { title: item.title, trigger: item.trigger } }).catch(() => undefined)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <span className="cyber-badge">{item.priority}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                {
                  label: "Streak alerts",
                  active: notificationPreferences.streakAlerts,
                  onClick: () => updateNotificationPreferences({ streakAlerts: !notificationPreferences.streakAlerts }),
                },
                {
                  label: "Referral alerts",
                  active: notificationPreferences.referralAlerts,
                  onClick: () => updateNotificationPreferences({ referralAlerts: !notificationPreferences.referralAlerts }),
                },
                {
                  label: "Email digest",
                  active: notificationPreferences.digestEnabled,
                  onClick: () => updateNotificationPreferences({ digestEnabled: !notificationPreferences.digestEnabled }),
                },
                {
                  label: "Push reminders",
                  active: notificationPreferences.pushEnabled,
                  onClick: () => updateNotificationPreferences({ pushEnabled: !notificationPreferences.pushEnabled }),
                },
              ].map((item) => (
                <button key={item.label} type="button" className="premium-nav-row cyber-card rounded-3xl" onClick={item.onClick}>
                  <span className="text-sm font-semibold text-white">{item.label}</span>
                  <span className={`terminal-font rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${item.active ? "border border-emerald-300/18 bg-emerald-500/10 text-emerald-100" : "border border-slate-600/70 bg-slate-900/70 text-slate-200"}`}>
                    {item.active ? "on" : "off"}
                  </span>
                </button>
              ))}
            </div>
          </article>

          <article className="premium-section-card cyber-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Real-time Debug</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Resilience signals, retries, and backend trace context</h2>
              </div>
              <Radar className="h-5 w-5 text-sky-200/90" />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                { label: "Request ID", value: debug.requestId || "pending" },
                { label: "Validation", value: debug.validationState },
                { label: "Auto-retry", value: debug.autoRetryReady ? "armed" : "off" },
              ].map((item) => (
                <div key={item.label} className="premium-signal-tile cyber-card rounded-[24px] p-4">
                  <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-4 text-sm font-semibold text-white break-all">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {debug.warnings.length ? debug.warnings.map((warning) => (
                <div key={warning} className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                  {warning}
                </div>
              )) : (
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                  Error capture is active and the latest mission-control snapshot returned cleanly.
                </div>
              )}
              {debug.recentEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="cyber-card rounded-[22px] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{event.stage}</p>
                    <span className="terminal-font text-[11px] uppercase tracking-[0.18em] text-slate-400">{event.level}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300/76">{event.message}</p>
                  {event.createdAt ? <p className="mt-2 text-xs text-slate-500">{event.createdAt}</p> : null}
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <article className="premium-section-card cyber-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Push + Digest</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Real delivery for retention and reactivation</h2>
              </div>
              <Send className="h-5 w-5 text-sky-200/90" />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="cyber-card rounded-[24px] p-4">
                <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-slate-500">Push status</p>
                <p className="mt-3 text-xl font-semibold text-white">
                  {growthOverview?.push.subscriptions ? `${growthOverview.push.subscriptions} browser subscription(s)` : "Not enabled yet"}
                </p>
                <p className="mt-2 text-sm text-slate-300/76">VAPID configured: {growthOverview?.push.configured ? "yes" : "no"}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="cyber-btn terminal-font" onClick={handleEnablePush}>
                    <Rocket className="h-4 w-4" />
                    Enable push
                  </button>
                  <button
                    type="button"
                    className="premium-nav-row rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200"
                    onClick={() =>
                      sendTestPush()
                        .then(() => toast({ title: "Test push sent" }))
                        .catch((error) => toast({ title: "Push failed", description: error instanceof Error ? error.message : "Please retry." }))
                    }
                  >
                    Send test
                  </button>
                </div>
              </div>
              <div className="cyber-card rounded-[24px] p-4">
                <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-slate-500">Weekly digest</p>
                <input
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none"
                  value={digestEmailDraft}
                  onChange={(event) => setDigestEmailDraft(event.target.value)}
                  placeholder="operator@company.com"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="cyber-btn terminal-font"
                    onClick={() =>
                      updateDigest({ email: digestEmailDraft, enabled: !(growthOverview?.digest.enabled === false) })
                        .then(() => toast({ title: "Digest preferences saved" }))
                        .catch((error) => toast({ title: "Digest save failed", description: error instanceof Error ? error.message : "Please retry." }))
                    }
                  >
                    Save digest email
                  </button>
                  <button
                    type="button"
                    className="premium-nav-row rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200"
                    onClick={() =>
                      sendDigestNow()
                        .then(() => toast({ title: "Digest sent", description: "Check your inbox for the live weekly brief." }))
                        .catch((error) => toast({ title: "Digest failed", description: error instanceof Error ? error.message : "Please retry." }))
                    }
                  >
                    Send now
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500">Last sent: {growthOverview?.digest.lastSentAt || "never"}</p>
              </div>
            </div>
          </article>

          <article className="premium-section-card cyber-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Streak + Certification</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Persistence that compounds operator skill</h2>
              </div>
              <Flame className="h-5 w-5 text-sky-200/90" />
            </div>
            <div className="cyber-card mt-5 rounded-[24px] p-4">
              <p className="text-sm font-semibold text-white">Streak freezes available: {growthOverview?.streakFreeze.available || 0}</p>
              <p className="mt-2 text-sm text-slate-300/76">One freeze is granted each ISO week and persists server-side until used.</p>
              <button
                type="button"
                className="cyber-btn terminal-font mt-4"
                onClick={() =>
                  reserveStreakFreeze()
                    .then(() => toast({ title: "Streak freeze reserved" }))
                    .catch((error) => toast({ title: "Freeze unavailable", description: error instanceof Error ? error.message : "Please retry." }))
                }
              >
                Protect streak
              </button>
            </div>
            {activeCertification ? (
              <div className="cyber-card mt-4 rounded-[24px] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{activeCertification.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{activeCertification.provider} · {activeCertification.completionPct}% complete</p>
                  </div>
                  {!activeCertification.enrolledAt ? (
                    <button
                      type="button"
                      className="cyber-btn terminal-font"
                      onClick={() =>
                        enrollCertification(activeCertification.id)
                          .then(() => toast({ title: "Certification path started" }))
                          .catch((error) => toast({ title: "Enrollment failed", description: error instanceof Error ? error.message : "Please retry." }))
                      }
                    >
                      Start path
                    </button>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-2">
                  {activeCertification.milestones.map((milestone) => (
                    <button
                      key={milestone.id}
                      type="button"
                      className="premium-nav-row cyber-card rounded-3xl"
                      onClick={() =>
                        updateMilestone({
                          pathId: activeCertification.id,
                          milestoneId: milestone.id,
                          completed: !milestone.completed,
                        })
                          .then(() => toast({ title: milestone.completed ? "Milestone reopened" : "Milestone completed" }))
                          .catch((error) => toast({ title: "Milestone update failed", description: error instanceof Error ? error.message : "Please retry." }))
                      }
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{milestone.title}</p>
                        <p className="mt-1 text-xs text-slate-400">{milestone.xp} XP</p>
                      </div>
                      <span className={`terminal-font rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${milestone.completed ? "border border-emerald-300/18 bg-emerald-500/10 text-emerald-100" : "border border-slate-600/70 bg-slate-900/70 text-slate-200"}`}>
                        {milestone.completed ? "done" : "open"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <article className="premium-section-card cyber-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Weekly CTF</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Operational event loop with real submissions</h2>
              </div>
              <Trophy className="h-5 w-5 text-sky-200/90" />
            </div>
            <div className="cyber-card mt-5 rounded-[24px] p-4">
              <p className="text-sm font-semibold text-white">{growthOverview?.ctfEvent.title || "Weekly CTF loading"}</p>
              <p className="mt-2 text-sm text-slate-300/76">{growthOverview?.ctfEvent.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="cyber-btn terminal-font"
                  onClick={() =>
                    joinWeeklyCtf()
                      .then(() => toast({ title: "Joined weekly CTF" }))
                      .catch((error) => toast({ title: "Join failed", description: error instanceof Error ? error.message : "Please retry." }))
                  }
                >
                  Join event
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {(growthOverview?.ctfEvent.challenges || []).slice(0, 3).map((challenge) => (
                <div key={challenge.id} className="cyber-card rounded-[24px] p-4">
                  <p className="text-sm font-semibold text-white">{challenge.title}</p>
                  <p className="mt-2 text-xs text-slate-400">{challenge.prompt}</p>
                  <p className="mt-2 text-xs text-cyan-100/70">{challenge.points} pts</p>
                  <div className="mt-3 flex gap-2">
                    <input
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                      value={ctfFlag}
                      onChange={(event) => setCtfFlag(event.target.value)}
                      placeholder="Submit flag"
                    />
                    <button
                      type="button"
                      className="cyber-btn terminal-font"
                      onClick={() =>
                        submitWeeklyFlag({ challengeId: challenge.id, flag: ctfFlag })
                          .then((result) => {
                            toast({ title: result.result.correct ? "Flag accepted" : "Incorrect flag" });
                            setCtfFlag("");
                          })
                          .catch((error) => toast({ title: "Submission failed", description: error instanceof Error ? error.message : "Please retry." }))
                      }
                    >
                      Submit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="premium-section-card cyber-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">GitHub + Billing</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">AI review and freemium conversion hooks</h2>
              </div>
              <Wallet className="h-5 w-5 text-sky-200/90" />
            </div>
            <div className="mt-5 grid gap-3">
              <div className="cyber-card rounded-[24px] p-4">
                <p className="text-sm font-semibold text-white">GitHub repository</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <input className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" value={githubOwner} onChange={(event) => setGithubOwner(event.target.value)} placeholder="owner" />
                  <input className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" value={githubRepo} onChange={(event) => setGithubRepo(event.target.value)} placeholder="repo" />
                  <input className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" value={githubBranch} onChange={(event) => setGithubBranch(event.target.value)} placeholder="branch" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="cyber-btn terminal-font"
                    onClick={() =>
                      connectGithub({ owner: githubOwner, repo: githubRepo, defaultBranch: githubBranch })
                        .then(() => toast({ title: "GitHub integration saved" }))
                        .catch((error) => toast({ title: "GitHub save failed", description: error instanceof Error ? error.message : "Please retry." }))
                    }
                  >
                    Save repo
                  </button>
                  <input className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" value={githubPr} onChange={(event) => setGithubPr(event.target.value)} placeholder="PR #" />
                  <button
                    type="button"
                    className="premium-nav-row rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200"
                    onClick={() =>
                      reviewPullRequest(Number(githubPr))
                        .then(() => toast({ title: "PR review generated" }))
                        .catch((error) => toast({ title: "Review failed", description: error instanceof Error ? error.message : "Please retry." }))
                    }
                  >
                    Review PR
                  </button>
                </div>
                {reviewResult ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-sm font-semibold text-white">{reviewResult.summary}</p>
                    <p className="mt-1 text-xs text-slate-400">Risk score: {reviewResult.riskScore}</p>
                  </div>
                ) : null}
              </div>
              <div className="cyber-card rounded-[24px] p-4">
                <p className="text-sm font-semibold text-white">Current plan: {growthOverview?.billing.planId || "free"}</p>
                <div className="mt-4 grid gap-2">
                  {(growthOverview?.billing.plans || []).map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      className="premium-nav-row cyber-card rounded-3xl"
                      onClick={() => {
                        if (plan.id === "free") return;
                        startCheckout(plan.id as "premium" | "team")
                          .then((result) => {
                            if (result.result.url) window.location.assign(result.result.url);
                          })
                          .catch((error) => toast({ title: "Checkout failed", description: error instanceof Error ? error.message : "Please retry." }));
                      }}
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{plan.name}</p>
                        <p className="mt-1 text-xs text-slate-400">${plan.priceMonthly}/month</p>
                      </div>
                      <span className={`terminal-font rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${plan.current ? "border border-emerald-300/18 bg-emerald-500/10 text-emerald-100" : "border border-slate-600/70 bg-slate-900/70 text-slate-200"}`}>
                        {plan.current ? "current" : "upgrade"}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="cyber-btn terminal-font mt-4"
                  onClick={() =>
                    openBillingPortal()
                      .then((result) => {
                        if (result.result.url) window.location.assign(result.result.url);
                      })
                      .catch((error) => toast({ title: "Portal unavailable", description: error instanceof Error ? error.message : "Please retry." }))
                  }
                >
                  Open billing portal
                </button>
              </div>
            </div>
          </article>
        </section>

        <section className="premium-section-card cyber-card">
          <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Monthly Referral Leaderboard</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {(referralLeaderboard || []).slice(0, 5).map((entry) => (
              <div key={entry.userId} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">{entry.position}. {entry.name}</p>
                <p className="mt-1 text-xs text-slate-400">@{entry.handle}</p>
                <p className="mt-3 text-lg font-semibold text-cyan-50">{entry.monthlyReferralPoints} pts</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
