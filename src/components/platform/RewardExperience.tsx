import { Award, Crown, Flame, Shield, Sparkles, Zap } from "lucide-react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useMissionSystem } from "@/context/MissionSystemApiContext";
import { useAuth } from "@/context/AuthContext";
import AchievementShareCard from "@/components/AchievementShareCard";
import { useAchievementNotifications, useReferralRecord } from "@/hooks/useGrowthFeatures";

const iconMap = {
  xp: Zap,
  streak: Flame,
  badge: Award,
} as const;

const badgeIconMap = {
  flame: Flame,
  crown: Crown,
  shield: Shield,
  spark: Sparkles,
} as const;

const RewardExperience = () => {
  const { activeReward, dismissReward, badges } = useMissionSystem();
  const { user } = useAuth();
  const { data: referral } = useReferralRecord();
  const [shareOpen, setShareOpen] = useState(false);
  useAchievementNotifications(activeReward);
  const shareUrl = useMemo(() => `${window.location.origin}/u/${user?.id || ""}`, [user?.id]);

  useEffect(() => {
    if (!activeReward) return;
    confetti({
      particleCount: activeReward.tone === "badge" ? 170 : 110,
      spread: 70,
      origin: { y: 0.3 },
      colors: ["#00ff88", "#0066ff", "#e2e8f0", "#1a1a2e"],
    });
    const timer = window.setTimeout(() => dismissReward(), 2800);
    return () => window.clearTimeout(timer);
  }, [activeReward, dismissReward]);

  useEffect(() => {
    if (!activeReward) return;
    setShareOpen(true);
  }, [activeReward]);

  if (!activeReward) return null;

  const PulseIcon = iconMap[activeReward.tone];

  return (
    <div className="mission-reward-layer pointer-events-none fixed inset-0 z-[80] flex items-start justify-end p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mission-reward-panel pointer-events-auto w-full max-w-sm overflow-hidden rounded-[28px] border border-cyan-300/24"
      >
        <div className="mission-reward-panel__glow" aria-hidden="true" />
        <div className="mission-reward-panel__scan" aria-hidden="true" />
        <div className="relative p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`mission-reward-icon mission-reward-icon--${activeReward.tone}`}
              >
                <PulseIcon className="h-5 w-5" />
              </motion.div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/62">Breach Complete</p>
                <h3 className="mt-2 text-xl font-semibold text-white">{activeReward.title}</h3>
                <p className="mt-1 text-sm text-slate-300/82">{activeReward.detail}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissReward}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-200 transition hover:bg-white/[0.08]"
            >
              Close
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-cyan-300/16 bg-black/25 px-4 py-3">
            <div>
              <p className="text-xs text-cyan-100/62">XP injected</p>
              <p className="mission-reward-xp text-2xl font-semibold text-white">+{activeReward.xp}</p>
            </div>
            <div className="mission-reward-orbs" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShareOpen((current) => !current)}
            className="mt-4 w-full rounded-2xl border border-cyan-300/18 bg-cyan-500/8 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-500/12"
          >
            {shareOpen ? "Hide intel card" : "Deploy share card"}
          </button>

          {badges.length ? (
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/62">Latest badges</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {badges.slice(0, 3).map((badge) => {
                  const BadgeIcon = badgeIconMap[badge.icon];
                  return (
                    <div key={badge.id} className="mission-badge-chip">
                      <BadgeIcon className="h-3.5 w-3.5" />
                      <span>{badge.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {shareOpen && user ? (
            <div className="mt-4">
              <AchievementShareCard
                userName={user.name}
                achievement={activeReward.title}
                detail={`${activeReward.detail} Referral code: ${referral?.code || "syncing"}`}
                shareUrl={shareUrl}
              />
            </div>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
};

export default RewardExperience;
