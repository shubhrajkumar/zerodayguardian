import { Award, Flame, Shield, Trophy } from "lucide-react";
import { useParams } from "react-router-dom";
import Seo from "@/components/Seo";
import { useMonthlyReferralLeaderboard, usePublicProfile } from "@/hooks/useGrowthFeatures";

const PublicProfilePage = () => {
  const { handle = "" } = useParams();
  const { data: profile, isLoading } = usePublicProfile(handle);
  const { data: leaderboard } = useMonthlyReferralLeaderboard();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-12 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-3xl bg-white/[0.04]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-[28px] border border-white/10 bg-black/25 p-8 text-center">
          <h1 className="text-3xl font-semibold text-white">Profile not found</h1>
          <p className="mt-3 text-slate-300/78">That operator profile is not public or does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <Seo
        title={`${profile.name} | ZeroDay Guardian Profile`}
        description={`${profile.name} has ${profile.xp} XP, ${profile.badges.length} badges, and a ${profile.streak}-day streak on ZeroDay Guardian.`}
        path={`/u/${profile.handle}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          name: profile.name,
          description: `${profile.name} public cybersecurity profile`,
          mainEntity: {
            "@type": "Person",
            name: profile.name,
            description: profile.headline,
          },
        }}
      />
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[36px] border border-cyan-300/16 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_30%),linear-gradient(180deg,#050910,#0a111d)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
          <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Public Operator Profile</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white">{profile.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300/78">{profile.headline}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              { icon: Trophy, label: "XP", value: `${profile.xp}` },
              { icon: Shield, label: "Level", value: `${profile.level}` },
              { icon: Flame, label: "Streak", value: `${profile.streak} days` },
              { icon: Award, label: "Labs", value: `${profile.completedLabs}` },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <item.icon className="h-5 w-5 text-cyan-200/90" />
                <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[28px] border border-white/10 bg-black/20 p-6">
            <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Badge Cabinet</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.badges.length ? profile.badges.map((badge) => (
                <span key={badge} className="rounded-full border border-cyan-300/16 bg-cyan-500/8 px-3 py-1 text-xs text-cyan-50">
                  {badge}
                </span>
              )) : <p className="text-sm text-slate-400">No public badges yet.</p>}
            </div>
          </article>

          <article className="rounded-[28px] border border-white/10 bg-black/20 p-6">
            <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Monthly Referral Leaders</p>
            <div className="mt-4 space-y-3">
              {(leaderboard || []).slice(0, 5).map((entry) => (
                <div key={entry.userId} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                  <div>
                    <p className="font-semibold text-white">{entry.name}</p>
                    <p className="text-xs text-slate-400">@{entry.handle}</p>
                  </div>
                  <span className="rounded-full border border-cyan-300/16 px-3 py-1 text-xs text-cyan-100">{entry.monthlyReferralPoints} pts</span>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
};

export default PublicProfilePage;

