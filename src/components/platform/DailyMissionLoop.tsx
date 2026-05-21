import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Crosshair, Flame, Radar, RefreshCcw, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { GamificationReward, GamificationSnapshot, MissionScope } from "@/lib/gamificationSystem";

type DailyMissionLoopProps = {
  snapshot: GamificationSnapshot;
  loading: boolean;
  error: string;
  latestReward: GamificationReward | null;
  onCompleteMission: (scope: MissionScope, missionId: string) => Promise<void> | void;
  onDismissReward: () => void;
  onRefresh: () => Promise<void> | void;
};

const animation = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };

const progressPct = (completed: number, total: number) => (total > 0 ? Math.round((completed / total) * 100) : 0);

const DailyMissionLoop = ({
  snapshot,
  loading,
  error,
  latestReward,
  onCompleteMission,
  onDismissReward,
  onRefresh,
}: DailyMissionLoopProps) => {
  const dailyCompleted = useMemo(() => snapshot.dailyMissions.filter((item) => item.completed).length, [snapshot.dailyMissions]);
  const weeklyCompleted = useMemo(() => snapshot.weeklyMissions.filter((item) => item.completed).length, [snapshot.weeklyMissions]);
  const dailyProgress = progressPct(dailyCompleted, snapshot.dailyMissions.length);
  const weeklyProgress = progressPct(weeklyCompleted, snapshot.weeklyMissions.length);
  const weekCleared = snapshot.weeklyMissions.length > 0 && weeklyCompleted === snapshot.weeklyMissions.length;

  useEffect(() => {
    if (!latestReward) return;
    const burst = latestReward.tone === "badge" || latestReward.tone === "level_up" ? 90 : 56;
    confetti({
      particleCount: burst,
      spread: 52,
      origin: { y: 0.35 },
      scalar: 0.72,
      ticks: 90,
      colors: ["#00ff88", "#0066ff", "#e2e8f0", "#1a1a2e"],
    });
    const timer = window.setTimeout(() => onDismissReward(), 1200);
    return () => window.clearTimeout(timer);
  }, [latestReward, onDismissReward]);

  return (
    <section data-reveal className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
      <article className="gamification-shell rounded-[28px] border border-emerald-400/18 p-5 sm:p-6">
        <div className="gamification-shell__bg" aria-hidden="true" />
        <div className="relative z-[1]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-emerald-200/70">Mission Briefing 🕵️</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#e2e8f0]">Deploy three clean wins before midnight</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300/82">
                Port scan. CVE read. CTF breach drill. No filler loops. Just visible progress, XP, and one elite direction.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="ghost-btn inline-flex min-h-[48px] items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Sync intel
            </button>
          </div>

          {error ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { label: "Daily XP Bank", value: `${snapshot.totalXp} XP`, detail: `Level ${snapshot.level} | ${snapshot.xpToNextLevel} XP to next breach`, icon: Sparkles },
              { label: "Streak Heat", value: `${snapshot.streakDays} days`, detail: `${snapshot.completedDays} daily loops cleared`, icon: Flame },
              { label: "Uplink", value: snapshot.serviceStatus === "ready" ? "Stable" : "Degraded", detail: snapshot.serviceMessage, icon: Radar },
            ].map((item) => (
              <div key={item.label} className="gamification-panel rounded-[24px] p-4">
                <item.icon className="h-5 w-5 text-emerald-300" />
                <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-[#e2e8f0]">{item.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300/78">{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="gamification-panel rounded-[24px] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-emerald-200/70">Daily Loop</p>
                  <p className="mt-2 text-lg font-semibold text-[#e2e8f0]">{dailyCompleted}/3 missions deployed</p>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-100">
                  {dailyProgress}% complete
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  className="h-full bg-[linear-gradient(90deg,#00ff88,#00c06a)]"
                  initial={false}
                  animate={{ width: `${dailyProgress}%` }}
                  transition={animation}
                />
              </div>
              <div className="mt-4 grid gap-3">
                {snapshot.dailyMissions.map((mission) => (
                  <motion.div
                    key={mission.id}
                    layout
                    transition={animation}
                    className="rounded-[22px] border border-white/8 bg-black/18 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#e2e8f0]">
                          <Crosshair className="h-4 w-4 text-emerald-300" />
                          {mission.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300/78">{mission.briefing}</p>
                      </div>
                      <span className="rounded-full border border-emerald-400/18 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-100">
                        +{mission.xp} XP
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{mission.completed ? "Breach complete" : mission.cta}</span>
                      <button
                        type="button"
                        disabled={mission.completed || loading}
                        onClick={() => void onCompleteMission("daily", mission.id)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                          mission.completed
                            ? "border border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                            : "border border-emerald-400/24 bg-white/[0.03] text-[#e2e8f0] hover:border-emerald-400/40 hover:bg-emerald-500/12"
                        }`}
                      >
                        {mission.completed ? "Intel Gathered" : mission.cta}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="gamification-panel rounded-[24px] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-blue-200/70">Weekly Missions</p>
                  <p className="mt-2 text-lg font-semibold text-[#e2e8f0]">{weeklyCompleted}/5 elite clears</p>
                </div>
                <span className="rounded-full border border-blue-400/18 bg-blue-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-blue-100">
                  {weeklyProgress}% complete
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  className="h-full bg-[linear-gradient(90deg,#0066ff,#00ff88)]"
                  initial={false}
                  animate={{ width: `${weeklyProgress}%` }}
                  transition={animation}
                />
              </div>
              {weekCleared ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={animation}
                  className="mt-4 rounded-[22px] border border-amber-300/20 bg-amber-500/10 p-4 text-amber-50"
                >
                  <p className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Trophy className="h-4 w-4" />
                    Week Cleared! You're Elite 🏴‍☠️
                  </p>
                  <p className="mt-2 text-sm text-amber-100/84">Every hard-mode briefing is closed. Keep pressure on the next cycle.</p>
                </motion.div>
              ) : null}
              <div className="mt-4 grid gap-3">
                {snapshot.weeklyMissions.map((mission) => (
                  <div key={mission.id} className="rounded-[22px] border border-white/8 bg-black/18 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#e2e8f0]">
                          <ShieldCheck className="h-4 w-4 text-blue-300" />
                          {mission.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300/78">{mission.briefing}</p>
                      </div>
                      <span className="rounded-full border border-blue-400/18 bg-blue-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-blue-100">
                        +{mission.xp} XP
                      </span>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        disabled={mission.completed || loading}
                        onClick={() => void onCompleteMission("weekly", mission.id)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                          mission.completed
                            ? "border border-blue-300/20 bg-blue-500/10 text-blue-100"
                            : "border border-blue-300/24 bg-white/[0.03] text-[#e2e8f0] hover:border-blue-300/42 hover:bg-blue-500/12"
                        }`}
                      >
                        {mission.completed ? "Cleared" : mission.cta}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </article>

      <article className="gamification-shell rounded-[28px] border border-blue-400/16 p-5 sm:p-6">
        <div className="gamification-shell__bg gamification-shell__bg--alt" aria-hidden="true" />
        <div className="relative z-[1]">
          {latestReward ? (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={animation}
              className="rounded-[24px] border border-emerald-400/22 bg-emerald-500/10 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="terminal-font text-[11px] uppercase tracking-[0.2em] text-emerald-100/72">Reward uplink</p>
                  <p className="mt-2 text-lg font-semibold text-[#e2e8f0]">{latestReward.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200/82">{latestReward.detail}</p>
                </div>
                <button type="button" onClick={onDismissReward} className="text-xs uppercase tracking-[0.18em] text-slate-300">
                  close
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-400/18 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-100">
                  {latestReward.xp ? `+${latestReward.xp} XP` : "Badge / Level unlocked"}
                </span>
                <motion.span
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="inline-flex rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-200"
                >
                  floating reward
                </motion.span>
              </div>
            </motion.div>
          ) : (
            <div className="rounded-[24px] border border-white/8 bg-black/18 p-4">
              <p className="terminal-font text-[11px] uppercase tracking-[0.2em] text-blue-100/70">Reward stream</p>
              <p className="mt-2 text-sm leading-6 text-slate-300/78">
                Mission clears, quiz wins, and badge unlocks land here with confetti, float motion, and level reveals.
              </p>
            </div>
          )}

          <div className="mt-4 rounded-[24px] border border-white/8 bg-black/18 p-4">
            <p className="terminal-font text-[11px] uppercase tracking-[0.2em] text-blue-100/70">Badge Cabinet</p>
            <div className="mt-4 grid gap-3">
              {snapshot.badges.length ? (
                snapshot.badges.slice(0, 6).map((badge) => (
                  <motion.div
                    key={badge.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={animation}
                    className="flex items-center gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-3"
                  >
                    <motion.span
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 text-lg"
                    >
                      {badge.icon}
                    </motion.span>
                    <div>
                      <p className="text-sm font-semibold text-[#e2e8f0]">{badge.title}</p>
                      <p className="text-xs leading-5 text-slate-300/74">{badge.detail}</p>
                    </div>
                  </motion.div>
                ))
              ) : (
                <p className="text-sm text-slate-400">Deploy missions and quiz wins to unlock the first cabinet item.</p>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-white/8 bg-black/18 p-4">
            <p className="terminal-font text-[11px] uppercase tracking-[0.2em] text-blue-100/70">Recent Intel</p>
            <div className="mt-4 grid gap-3">
              {snapshot.recentRewards.length ? (
                snapshot.recentRewards.slice(0, 5).map((reward) => (
                  <div key={reward.id} className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#e2e8f0]">
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      {reward.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-300/76">{reward.detail}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">The reward stream will populate after the first clean action.</p>
              )}
            </div>
          </div>
        </div>
      </article>
    </section>
  );
};

export default DailyMissionLoop;
