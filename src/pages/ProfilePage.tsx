import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Award, BookOpen, Flame, Zap, Settings, LogOut } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { useAuth } from "@/context/AuthContext";
import { useUserProgress } from "@/context/UserProgressContext";
import { useGamificationSystem, getLevelLabel } from "@/lib/gamificationSystem";
import XPBar from "@/components/gamification/XPBar";
import StreakCounter from "@/components/gamification/StreakCounter";
import BadgeDisplay from "@/components/gamification/BadgeDisplay";
import LeaderboardCard from "@/components/gamification/LeaderboardCard";
import api from "@/lib/api";

interface UserProfile {
  name?: string;
  email?: string;
  handle?: string;
  avatar?: string;
  joinedAt?: string;
}

interface ActivityItem {
  icon: string;
  text: string;
  date: Date;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { progress } = useUserProgress();
  const { snapshot, loading: gamificationLoading } = useGamificationSystem(user?.id, user?.name || undefined);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const displayName = profile?.name || user?.name || user?.email?.split("@")[0] || "Guardian";
  const email = profile?.email || user?.email || "";
  const handle = profile?.handle || displayName.toLowerCase().replace(/\s+/g, ".");
  const xp = progress?.xp ?? snapshot.totalXp;
  const streak = progress?.streak ?? snapshot.streakDays;
  const rank = progress?.rank || getLevelLabel(snapshot.level);
  const labsCompleted = progress?.completedLabs ?? 0;

  useEffect(() => {
    let mounted = true;
    api.get<UserProfile>("/api/users/profile").then((res) => { if (mounted) setProfile(res.data); }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const stats = useMemo(() => [
    { label: "XP", value: xp.toLocaleString(), icon: <Zap className="h-4 w-4" />, color: "var(--theme-accent-blue)" },
    { label: "Rank", value: rank, icon: <Award className="h-4 w-4" />, color: "var(--theme-accent-purple)" },
    { label: "Labs", value: labsCompleted.toString(), icon: <BookOpen className="h-4 w-4" />, color: "var(--theme-accent-green)" },
    { label: "Streak", value: `${streak}d`, icon: <Flame className="h-4 w-4" />, color: "var(--theme-accent-orange)" },
  ], [xp, rank, labsCompleted, streak]);

  const recentActivity: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];
    if (snapshot.recentRewards.length > 0) {
      snapshot.recentRewards.slice(0, 5).forEach((r) => {
        items.push({ icon: r.tone === "badge" ? "🏆" : r.tone === "level_up" ? "⬆️" : "⚡", text: r.title, date: new Date(r.createdAt) });
      });
    }
    if (items.length === 0) {
      items.push(
        { icon: "🛡️", text: "Account created", date: new Date() },
      );
    }
    return items;
  }, [snapshot.recentRewards]);

  const handleSignOut = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 page-shell">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm transition-colors"
          style={{ color: "var(--theme-text-muted)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {/* Profile Header */}
        <GlassCard className="p-6 md:p-8 animate-fade-in-up">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold border-2 border-[var(--theme-accent-blue)]/30"
              style={{
                background: "linear-gradient(135deg, var(--theme-accent-blue), var(--theme-accent-purple))",
                color: "var(--theme-bg)",
              }}
            >
              {displayName[0]?.toUpperCase() || "G"}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--theme-text)" }}>{displayName}</h1>
              <p className="text-sm mt-1" style={{ color: "var(--theme-text-muted)" }}>@{handle}</p>
              {email && <p className="text-xs mt-1" style={{ color: "var(--theme-text-dim)" }}>{email}</p>}

              {/* Stats row */}
              <div className="flex flex-wrap gap-3 mt-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 border"
                    style={{
                      backgroundColor: "var(--theme-overlay)",
                      borderColor: "var(--theme-border)",
                    }}
                  >
                    <span style={{ color: stat.color }}>{stat.icon}</span>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--theme-text)" }}>{stat.value}</p>
                      <p className="text-[10px]" style={{ color: "var(--theme-text-dim)" }}>{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate("/security")}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all"
                style={{
                  backgroundColor: "var(--theme-overlay)",
                  color: "var(--theme-text-muted)",
                  border: "1px solid var(--theme-border)",
                }}
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--theme-accent-red, #ff4757) 10%, transparent)",
                  color: "var(--theme-accent-red, #ff4757)",
                  border: "1px solid color-mix(in srgb, var(--theme-accent-red, #ff4757) 20%, transparent)",
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </div>
          </div>
        </GlassCard>

        {/* XP & Streak */}
        <div className="grid gap-4 sm:grid-cols-2 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <XPBar snapshot={snapshot} />
          <StreakCounter snapshot={snapshot} />
        </div>

        {/* Badges */}
        <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <BadgeDisplay badges={snapshot.badges} />
        </div>

        {/* Leaderboard */}
        <div className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          <LeaderboardCard />
        </div>

        {/* Recent Activity */}
        <GlassCard className="p-5 animate-fade-in-up" style={{ animationDelay: "400ms" }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--theme-text)" }}>Recent Activity</h2>
          <div className="space-y-3" role="list" aria-label="Recent activity">
            {recentActivity.map((activity, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                role="listitem"
                style={{ backgroundColor: "var(--theme-overlay)" }}
              >
                <span className="text-lg">{activity.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: "var(--theme-text)" }}>{activity.text}</p>
                  <p className="text-xs" style={{ color: "var(--theme-text-dim)" }}>
                    {activity.date.toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
