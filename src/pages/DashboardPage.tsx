import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useGamificationSystem, getLevelLabel } from "@/lib/gamificationSystem";
import AnimatedCyberBackground from "@/components/AnimatedCyberBackground";
import LiveClock, { formatRelativeTime } from "@/components/ui/LiveClock";
import SentryTestPanel from "@/components/SentryTestPanel";
import XPBar from "@/components/gamification/XPBar";
import StreakCounter from "@/components/gamification/StreakCounter";
import BadgeDisplay from "@/components/gamification/BadgeDisplay";
import LeaderboardCard from "@/components/gamification/LeaderboardCard";

type SidebarItem = {
  label: string;
  icon: string;
  path: string;
  badge?: string;
};

const sidebarItems: SidebarItem[] = [
  { label: "Dashboard", icon: "⊞", path: "/dashboard" },
  { label: "AI Assistant", icon: "✦", path: "/assistant" },
  { label: "Tools", icon: "⚙", path: "/tools" },
  { label: "Labs", icon: "⚡", path: "/labs" },
  { label: "Learn", icon: "📖", path: "/learn" },
  { label: "Community", icon: "🌐", path: "/community" },
  { label: "Profile", icon: "👤", path: "/profile" },
];

export default function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { snapshot } = useGamificationSystem(user?.id, user?.name || undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const displayName = user?.name || user?.email?.split("@")[0] || "Guardian";
  const xp = snapshot.totalXp;
  const streak = snapshot.streakDays;
  const badges = snapshot.badges.length;
  const rank = getLevelLabel(snapshot.level);

  const stats = [
    { label: "XP", value: xp.toLocaleString(), icon: "⚡", color: "from-[#00d4ff] to-[#0099cc]" },
    { label: "Streak", value: `${streak} days`, icon: "🔥", color: "from-[#ff6b35] to-[#ff3355]" },
    { label: "Badges", value: badges.toString(), icon: "🏆", color: "from-[#ffd700] to-[#ffaa00]" },
    { label: "Rank", value: rank, icon: "🛡️", color: "from-[#00ff88] to-[#00cc6a]" },
  ];

  const quickActions = [
    { label: "AI Assistant", icon: "✦", desc: "Chat with Zorvix AI", path: "/assistant" },
    { label: "Run Lab", icon: "⚡", desc: "Practice in sandbox", path: "/labs" },
    { label: "Tools", icon: "⚙", desc: "Launch security tools", path: "/tools" },
    { label: "Learn", icon: "📖", desc: "Continue coursework", path: "/learn" },
  ];

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: "var(--theme-bg)" }}>
      <AnimatedCyberBackground />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar-panel ${sidebarOpen ? "open" : ""}`}>
        <div className="p-5" style={{ borderBottom: "1px solid var(--theme-border)" }}>
          <div className="flex items-center gap-3">              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--theme-accent-blue)] to-[var(--theme-accent-purple)] flex items-center justify-center font-bold text-sm" style={{ color: "var(--theme-bg)" }}>
              Z
            </div>
            <span className="font-semibold text-sm" style={{ color: "var(--theme-text)" }}>
              ZeroDay <span style={{ color: "var(--theme-accent-blue)" }}>Guardian</span>
            </span>
          </div>
        </div>

        <nav className="p-3 space-y-1" aria-label="Dashboard sidebar navigation">
          {sidebarItems.map((item) => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setSidebarOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group hover:bg-[var(--theme-overlay)]"
              aria-current={location.pathname === item.path ? "page" : undefined}
              style={{ color: "var(--theme-text-muted)" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--theme-text)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--theme-text-muted)"}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--theme-accent-blue) 10%, transparent)", color: "var(--theme-accent-blue)" }}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto p-4" style={{ borderTop: "1px solid var(--theme-border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium" style={{ backgroundColor: "var(--theme-border)", color: "var(--theme-text)" }}>
              {displayName[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm truncate" style={{ color: "var(--theme-text)" }}>{displayName}</p>
              <p className="text-[10px]" style={{ color: "var(--theme-text-dim)" }}>{rank}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-72">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 glass lg:hidden" style={{ borderBottom: "1px solid var(--theme-border)" }}>
          <div className="flex items-center justify-between px-4 h-14">
            <button
              onClick={() => setSidebarOpen(true)}
              className="btn-cyber-ghost p-3 -m-1"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#7b2ff7] flex items-center justify-center text-[#0a0a0f] font-bold text-xs">
                Z
              </div>
              <span className="font-semibold text-sm" style={{ color: "var(--theme-text)" }}>Dashboard</span>
            </div>

            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: "var(--theme-border)", color: "var(--theme-text)" }}>
              {displayName[0].toUpperCase()}
            </div>
          </div>
        </header>

        <main className="page-container py-6 md:py-8">
          {/* Welcome Section */}
          <div className="glass-card p-6 md:p-8 mb-6 animate-fade-in-up">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: "var(--theme-text)" }}>
                  {greeting}, {displayName}
                </h1>
                <p className="text-sm" style={{ color: "var(--theme-text-muted)" }}>
                  Your security command center is ready. {streak > 0 && `${streak}-day streak — keep it going!`}
                </p>
              </div>
              <div className="hidden sm:flex flex-col items-end gap-2">
                <LiveClock />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--theme-accent-green) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--theme-accent-green) 20%, transparent)" }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--theme-accent-green)" }} />
                  <span className="text-xs font-medium" style={{ color: "var(--theme-accent-green)" }}>System Online</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className="glass-card p-4 md:p-5 animate-fade-in-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center text-sm`}>
                    {stat.icon}
                  </div>
                </div>
                <p className="text-2xl md:text-3xl font-bold mb-0.5" style={{ color: "var(--theme-text)" }}>{stat.value}</p>
                <p className="text-xs font-medium" style={{ color: "var(--theme-text-dim)" }}>{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--theme-text)" }}>Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickActions.map((action, i) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className="glass-card p-4 text-left transition-all duration-300 animate-fade-in-up group"
                  style={{ animationDelay: `${(i + 4) * 100}ms` }}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg mb-3 transition-colors" style={{ backgroundColor: "color-mix(in srgb, var(--theme-accent-blue) 10%, transparent)" }}>
                    {action.icon}
                  </div>
                  <h3 className="text-sm font-semibold mb-0.5" style={{ color: "var(--theme-text)" }}>{action.label}</h3>
                  <p className="text-xs" style={{ color: "var(--theme-text-dim)" }}>{action.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <SentryTestPanel />

          {/* Gamification Section */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--theme-text)" }}>Your Progress</h2>
            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <XPBar snapshot={snapshot} />
              <StreakCounter snapshot={snapshot} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <BadgeDisplay badges={snapshot.badges} />
              <LeaderboardCard />
            </div>
          </div>

          {/* Recent Activity */}
          <div className="glass-card p-5 animate-fade-in-up">
            <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--theme-text)" }}>Recent Activity</h2>
            <div className="space-y-3" role="list" aria-label="Recent activity">
              {[
                { icon: "🛡️", text: "Threat scan completed", date: new Date(Date.now() - 2 * 60 * 1000), color: "green" },
                { icon: "📊", text: "Weekly report generated", date: new Date(Date.now() - 1 * 60 * 60 * 1000), color: "blue" },
                { icon: "⚡", text: "Lab exercise completed", date: new Date(Date.now() - 3 * 60 * 60 * 1000), color: "purple" },
              ].map((activity, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg transition-colors" role="listitem" style={{ backgroundColor: "var(--theme-overlay)" }}
    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--theme-overlay-hover)"}
    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--theme-overlay)"}>
                  <span className="text-lg">{activity.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: "var(--theme-text)" }}>{activity.text}</p>
                    <p className="text-xs" style={{ color: "var(--theme-text-dim)" }}>{formatRelativeTime(activity.date)}</p>
                  </div>
                  <span className={`w-1.5 h-1.5 rounded-full ${activity.color === "green" ? "bg-[#00ff88]" : activity.color === "blue" ? "bg-[#00d4ff]" : "bg-[#7b2ff7]"}`} />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
