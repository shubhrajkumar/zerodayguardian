import { useMemo, useState } from "react";
import type { GamificationBadge } from "@/lib/gamificationSystem";
import type { Badge } from "./badges";
import { CYBERSECURITY_BADGES } from "./badges";

export interface BadgeDisplayProps {
  /** Badge catalog to render. Defaults to the ZeroDay Guardian cybersecurity catalog. */
  badges?: Badge[] | GamificationBadge[];
  /** Earned badge ids. If omitted, legacy `GamificationBadge[]` entries are treated as earned badges. */
  earnedBadges?: string[];
}

const legacyBadgeMap: Record<string, string> = {
  "signal-hunter": "first-blood",
  "intel-scribe": "bug-hunter",
  "ctf-raider": "offense-master",
  "daily-loop-cleared": "streak-master",
  "weekly-elite": "xp-legend",
  "quiz-ace": "perfectionist",
  "chain-builder": "code-warrior",
  "intel-architect": "bug-hunter",
  "surface-cartographer": "defense-expert",
  "elite-raider": "speed-demon",
  "blue-team-forge": "defense-expert",
};

const isCatalogBadge = (badge: Badge | GamificationBadge): badge is Badge =>
  "name" in badge && "description" in badge && "requirement" in badge;

const normalizeCatalog = (badges?: Badge[] | GamificationBadge[]): Badge[] => {
  if (!badges?.length) return CYBERSECURITY_BADGES;
  if (badges.every(isCatalogBadge)) return badges;
  return CYBERSECURITY_BADGES;
};

const normalizeEarned = (badges?: Badge[] | GamificationBadge[], earnedBadges?: string[]) => {
  if (earnedBadges) return new Set(earnedBadges);
  const earned = new Set<string>();
  for (const badge of badges || []) {
    if (isCatalogBadge(badge)) continue;
    earned.add(legacyBadgeMap[badge.id] || badge.id);
  }
  return earned;
};

/**
 * Renders earned and locked cybersecurity badges in a responsive grid.
 *
 * Locked badges are dimmed; hover and focus reveal the badge description and
 * unlock requirement.
 */
export default function BadgeDisplay({ badges, earnedBadges }: BadgeDisplayProps) {
  const [activeBadgeId, setActiveBadgeId] = useState<string | null>(null);
  const catalog = useMemo(() => normalizeCatalog(badges), [badges]);
  const earned = useMemo(() => normalizeEarned(badges, earnedBadges), [badges, earnedBadges]);

  return (
    <section
      className="rounded-xl border border-slate-800/50 bg-slate-900/40 p-4 hologram-card"
      aria-labelledby="badges-title"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p id="badges-title" className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span className="text-emerald-400">🏅</span> Achievements
          </p>
          <p className="text-xs text-slate-500 font-mono">
            {earned.size} / {catalog.length} collected
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {catalog.map((badge) => {
          const isEarned = earned.has(badge.id);
          const tooltipId = `badge-${badge.id}-tooltip`;
          const active = activeBadgeId === badge.id;
          return (
            <div
              key={badge.id}
              className="relative"
              onMouseEnter={() => setActiveBadgeId(badge.id)}
              onMouseLeave={() => setActiveBadgeId(null)}
              onFocus={() => setActiveBadgeId(badge.id)}
              onBlur={() => setActiveBadgeId(null)}
            >
              <button
                type="button"
                className={`flex min-h-[6.25rem] w-full flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 ${
                  isEarned
                    ? "border-emerald-500/30 bg-emerald-500/10 text-slate-100 hover:border-emerald-400/50 hover:shadow-[0_0_12px_rgba(52,211,153,0.1)]"
                    : "border-slate-800/40 bg-slate-800/10 text-slate-500 opacity-40"
                }`}
                aria-label={`${badge.name} badge - ${isEarned ? "collected" : "locked"}`}
                aria-describedby={active ? tooltipId : undefined}
              >
                <span className="text-2xl" aria-hidden="true" style={{
                  filter: isEarned ? "drop-shadow(0 0 6px rgba(52,211,153,0.3))" : undefined,
                }}>
                  {badge.icon}
                </span>
                <span className="text-xs font-semibold">{badge.name}</span>
              </button>

              {active ? (
                <div
                  id={tooltipId}
                  role="tooltip"
                  className="absolute bottom-full left-1/2 z-20 mb-2 w-52 -translate-x-1/2 rounded-lg border border-slate-700/50 bg-slate-900/95 backdrop-blur-xl p-3 text-left shadow-xl"
                >
                  <p className="text-xs font-semibold text-slate-100">{badge.name}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{badge.description}</p>
                  <p className="mt-2 text-[10px] font-mono text-slate-500">Requirement: {badge.requirement}</p>
                  <p className={isEarned ? "mt-1 text-[11px] text-emerald-300" : "mt-1 text-[11px] text-slate-500"}>
                    {isEarned ? "✓ Collected" : "Locked"}
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
