import { useState } from "react";
import type { GamificationBadge } from "@/lib/gamificationSystem";

interface BadgeDisplayProps {
  badges: GamificationBadge[];
}

const defaultBadgeCatalog = [
  { id: "signal-hunter", title: "Signal Hunter", icon: "📡", detail: "Completed the daily recon sweep." },
  { id: "intel-scribe", title: "Intel Scribe", icon: "📚", detail: "Converted a live CVE into actionable notes." },
  { id: "ctf-raider", title: "CTF Raider", icon: "🏴‍☠️", detail: "Cleared the daily breach drill." },
  { id: "daily-loop-cleared", title: "Mission Loop Cleared", icon: "🕵️", detail: "All daily ops deployed before midnight." },
  { id: "weekly-elite", title: "Week Cleared Elite", icon: "👑", detail: "Every weekly challenge closed cleanly." },
  { id: "quiz-ace", title: "Cipher Ace", icon: "🧠", detail: "Five correct answers in one briefing." },
  { id: "chain-builder", title: "Chain Builder", icon: "⚔️", detail: "Built a disciplined exploit chain." },
  { id: "intel-architect", title: "Intel Architect", icon: "🛰️", detail: "Turned raw signals into direction." },
  { id: "surface-cartographer", title: "Surface Cartographer", icon: "🗺️", detail: "Mapped the attack surface with precision." },
  { id: "elite-raider", title: "Elite Raider", icon: "💀", detail: "Closed a high-pressure weekly CTF sprint." },
  { id: "blue-team-forge", title: "Blue Team Forge", icon: "🛡️", detail: "Translated offense into defense." },
];

const categories = [
  { key: "all", label: "All" },
  { key: "learning", label: "Learning" },
  { key: "labs", label: "Labs" },
  { key: "osint", label: "OSINT" },
  { key: "community", label: "Community" },
];

const categoryMap: Record<string, string[]> = {
  learning: ["intel-scribe", "quiz-ace", "intel-architect"],
  labs: ["signal-hunter", "chain-builder", "surface-cartographer", "blue-team-forge"],
  osint: ["ctf-raider", "elite-raider"],
  community: ["daily-loop-cleared", "weekly-elite"],
};

export default function BadgeDisplay({ badges }: BadgeDisplayProps) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);

  const earnedIds = new Set(badges.map((b) => b.id));

  const filteredCatalog = defaultBadgeCatalog.filter((b) => {
    if (activeCategory === "all") return true;
    return categoryMap[activeCategory]?.includes(b.id) ?? false;
  });

  return (
    <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-medium" style={{ color: "var(--theme-text-muted)" }}>Achievements</p>
          <p className="text-sm font-semibold" style={{ color: "var(--theme-text)" }}>
            {badges.length} / {defaultBadgeCatalog.length} earned
          </p>
        </div>
      </div>

      <div className="flex gap-1.5 mb-3 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className="shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all"
            style={{
              backgroundColor: activeCategory === cat.key ? "var(--theme-accent-blue)" : "var(--theme-overlay)",
              color: activeCategory === cat.key ? "var(--theme-bg)" : "var(--theme-text-muted)",
              border: `1px solid ${activeCategory === cat.key ? "var(--theme-accent-blue)" : "var(--theme-border)"}`,
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {filteredCatalog.map((template) => {
          const earned = earnedIds.has(template.id);
          const badge = badges.find((b) => b.id === template.id);
          return (              <div
                key={template.id}
                className="relative"
                onMouseEnter={() => setHoveredBadge(template.id)}
                onMouseLeave={() => setHoveredBadge(null)}
              >
                <div
                  className="flex h-16 w-full items-center justify-center rounded-xl border transition-all duration-200"
                  role="img"
                  aria-label={`${template.title} badge - ${earned ? "earned" : "locked"}`}
                style={{
                  borderColor: earned ? "var(--theme-accent-blue)" : "var(--theme-border)",
                  backgroundColor: earned ? "var(--theme-accent-blue-dim, color-mix(in srgb, var(--theme-accent-blue) 10%, transparent))" : "var(--theme-overlay)",
                  opacity: earned ? 1 : 0.4,
                  transform: hoveredBadge === template.id ? "scale(1.1)" : "scale(1)",
                  boxShadow: earned && hoveredBadge === template.id ? "0 0 16px var(--theme-glow)" : "none",
                }}
              >
                <span className="text-2xl" style={{ filter: earned ? "none" : "grayscale(100%)" }}>
                  {template.icon}
                </span>
              </div>

              {hoveredBadge === template.id && (
                <div
                  className="absolute bottom-full left-1/2 z-50 mb-2 w-40 -translate-x-1/2 rounded-xl border p-3 shadow-lg"
                  role="tooltip"
                  style={{
                    backgroundColor: "var(--theme-card)",
                    borderColor: "var(--theme-border)",
                    backdropFilter: "blur(16px)",
                  }}
                >
                  <p className="text-xs font-semibold" style={{ color: "var(--theme-text)" }}>{template.title}</p>
                  <p className="mt-1 text-[10px] leading-relaxed" style={{ color: "var(--theme-text-muted)" }}>{template.detail}</p>
                  {badge && (
                    <p className="mt-1 text-[10px]" style={{ color: "var(--theme-accent-green)" }}>
                      Earned {new Date(badge.earnedAt).toLocaleDateString()}
                    </p>
                  )}
                  {!earned && (
                    <p className="mt-1 text-[10px] italic" style={{ color: "var(--theme-text-dim)" }}>Locked</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
