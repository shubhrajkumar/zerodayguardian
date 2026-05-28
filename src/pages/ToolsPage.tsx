import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, ChevronDown, Grid2x2, Search, Shield, ShieldCheck, Sparkles } from "lucide-react";
import ToolCard from "@/components/ToolCard";
import {
  TOOL_FILTERS,
  TOOL_GROUP_META,
  TOOL_GROUP_ORDER,
  getToolsCatalog,
  getToolIcon,
  toolMatchesFilter,
  toolSearchIndex,
  type ToolFilter,
  type ToolDefinition,
} from "@/lib/toolCatalog";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useUserProgress } from "@/context/UserProgressContext";
import { useMissionSystem } from "@/context/MissionSystemApiContext";

const ToolsPage = () => {
  const { trackAction } = useUserProgress();
  const { unlockedGates, hiddenChallenges, discoverHiddenChallenge, completeHiddenChallenge } = useMissionSystem();
  const [searchTerm, setSearchTerm] = useState(() => {
    try {
      return localStorage.getItem("tools:search-term") || "";
    } catch {
      return "";
    }
  });
  const [activeFilter, setActiveFilter] = useState<ToolFilter>(() => {
    try {
      const stored = localStorage.getItem("tools:active-filter") as ToolFilter | null;
      return stored && TOOL_FILTERS.includes(stored) ? stored : "All Tools";
    } catch {
      return "All Tools";
    }
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const defaults = {
      "AI Command": true,
      "Security Analysis": true,
      "Research & OSINT": true,
      "Learning & Lab": true,
    };
    try {
      const raw = localStorage.getItem("tools:open-groups");
      return raw ? { ...defaults, ...(JSON.parse(raw) as Record<string, boolean>) } : defaults;
    } catch {
      return defaults;
    }
  });
  const [recentToolIds, setRecentToolIds] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem("tools:recent");
      return raw ? (JSON.parse(raw) as number[]).slice(0, 6) : [];
    } catch {
      return [];
    }
  });
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [toolsCatalog, setToolsCatalog] = useState<ToolDefinition[]>([]);
  const [toolsReady, setToolsReady] = useState(false);
  useScrollReveal([headlineIndex, activeFilter, searchTerm]);

  useEffect(() => {
    let active = true;

    getToolsCatalog()
      .then((tools) => {
        if (!active) return;
        setToolsCatalog(tools);
        setToolsReady(true);
      })
      .catch(() => {
        if (!active) return;
        setToolsCatalog([]);
        setToolsReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredTools = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return toolsCatalog.filter((tool) => {
      const isIntelTool = tool.group === "Research & OSINT";
      const isAdvancedLearningTool = tool.group === "Learning & Lab" && /advanced|pro|elite/i.test(`${tool.name} ${tool.description}`);
      if (isIntelTool && !unlockedGates.intel_tools) return false;
      if (isAdvancedLearningTool && !unlockedGates.advanced_labs) return false;
      if (!toolMatchesFilter(tool, activeFilter)) return false;
      if (!query) return true;
      return toolSearchIndex(tool).includes(query);
    });
  }, [activeFilter, searchTerm, toolsCatalog, unlockedGates.advanced_labs, unlockedGates.intel_tools]);

  const groupedTools = useMemo(() => {
    const next: Record<string, typeof filteredTools> = {};
    for (const group of TOOL_GROUP_ORDER) {
      next[group] = filteredTools.filter((tool) => tool.group === group);
    }
    return next;
  }, [filteredTools]);

  const categoryMetrics = useMemo(
    () =>
      TOOL_FILTERS.filter((filter) => filter !== "All Tools").map((filter) => ({
        label: filter,
        total: toolsCatalog.filter((tool) => toolMatchesFilter(tool, filter)).length,
      })),
    [toolsCatalog]
  );

  const activeCount = filteredTools.length;
  const verifiedCount = useMemo(() => toolsCatalog.filter((tool) => tool.workspace !== "lab" && tool.workspace !== "learning").length, [toolsCatalog]);
  const learningCount = useMemo(() => toolsCatalog.filter((tool) => tool.workspace === "lab" || tool.workspace === "learning").length, [toolsCatalog]);
  const recentTools = useMemo(
    () =>
      recentToolIds
        .map((id) => toolsCatalog.find((tool) => tool.id === id))
        .filter((tool): tool is ToolDefinition => Boolean(tool))
        .slice(0, 4),
    [recentToolIds, toolsCatalog]
  );
  const smartSuggestions = useMemo(() => {
    const suggestions = [
      ...(recentTools[0] ? [`Resume ${recentTools[0].name}`] : []),
      ...(activeFilter !== "All Tools" ? [`Stay in ${activeFilter}`] : ["Browse verified live workspaces"]),
      ...(searchTerm.trim() ? [`Search saved for "${searchTerm.trim()}"`] : ["Try a recent tool for instant re-entry"]),
    ];
    return suggestions.slice(0, 3);
  }, [activeFilter, recentTools, searchTerm]);
  const dynamicHeadlines = [
    "The fastest path to signal usually starts with one sharp filter.",
    "Hidden tool value shows up when the next workspace feels obvious.",
    "Verified operations convert better when live work and training stay clearly separated.",
  ];
  const operatorOverride = hiddenChallenges.find((challenge) => challenge.id === "operator-override") || null;

  useEffect(() => {
    try {
      localStorage.setItem("tools:search-term", searchTerm);
    } catch {
      // ignore local storage issues
    }
  }, [searchTerm]);

  useEffect(() => {
    try {
      localStorage.setItem("tools:active-filter", activeFilter);
    } catch {
      // ignore local storage issues
    }
  }, [activeFilter]);

  useEffect(() => {
    try {
      localStorage.setItem("tools:open-groups", JSON.stringify(openGroups));
    } catch {
      // ignore local storage issues
    }
  }, [openGroups]);
  useEffect(() => {
    const timer = window.setInterval(() => setHeadlineIndex((current) => (current + 1) % dynamicHeadlines.length), 3400);
    return () => window.clearInterval(timer);
  }, [dynamicHeadlines.length]);

  useEffect(() => {
    const handleRecentUpdate = () => {
      try {
        const raw = localStorage.getItem("tools:recent");
        setRecentToolIds(raw ? (JSON.parse(raw) as number[]).slice(0, 6) : []);
      } catch {
        setRecentToolIds([]);
      }
    };
    window.addEventListener("tools:recent-updated", handleRecentUpdate);
    return () => window.removeEventListener("tools:recent-updated", handleRecentUpdate);
  }, []);

  return (
    <div className="page-shell bg-[#050816]">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="mx-auto max-w-7xl space-y-8">
          <section data-reveal className="engagement-strip">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <span className="engagement-kicker">
                  <Sparkles className="h-3.5 w-3.5" />
                  Smart Discovery
                </span>
                <h2 className="engagement-headline mt-3 text-xl font-semibold text-white md:text-2xl">
                  {dynamicHeadlines[headlineIndex]}
                </h2>
              </div>
              <div className="engagement-marquee">
                {[`${activeCount} visible tools`, `${verifiedCount} verified workspaces`, recentTools[0] ? `Resume ${recentTools[0].name}` : "Use smart search"].map((item) => (
                  <span key={item} className="engagement-pill">{item}</span>
                ))}
              </div>
            </div>
          </section>

          {!toolsReady ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`tools-skeleton-${index}`} className="skeleton-block min-h-[320px] rounded-[28px]" />
              ))}
            </section>
          ) : null}

          {toolsReady && !toolsCatalog.length ? (
            <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,25,0.96),rgba(5,9,19,0.96))] p-6 text-sm text-slate-300">
              The live tools catalog is currently unavailable. Workspace endpoints are still present, but the catalog feed returned no tools.
            </section>
          ) : null}

          <section data-reveal className="app-smooth-enter premium-surface overflow-hidden rounded-[32px] border border-cyan-400/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_85%_18%,rgba(59,130,246,0.18),transparent_30%),linear-gradient(180deg,rgba(7,13,29,0.98),rgba(4,8,20,0.98))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.36)] md:p-8">
            <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/85">
                  <Sparkles className="h-3.5 w-3.5" />
                  Verified Security Tools Hub
                </div>
                <div className="space-y-4">
                  <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-50 md:text-5xl">
                    Elite workspaces for verified operations, trusted AI analysis, and clearly separated training labs.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-slate-300/82">
                    Verified DNS, MX, WHOIS, headers, website scans, and AI-guided workflows stay separate from guided training ranges.
                    The hub is searchable, mission-grouped, and tuned for real operator flow with clear boundaries between production tooling and lab execution.
                  </p>
                </div>
                <div className="relative max-w-2xl">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/55" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                      if (event.target.value.trim().length >= 3) {
                        trackAction({
                          type: "tools_search",
                          tool: "tools",
                          query: event.target.value.trim(),
                          depth: 1,
                          success: true,
                        }).catch(() => undefined);
                      }
                    }}
                    placeholder="Search tools by keyword, capability, or workflow"
                    className="h-14 w-full rounded-2xl border border-cyan-300/15 bg-black/30 pl-12 pr-4 text-sm text-slate-100 outline-none ring-0 transition-colors placeholder:text-slate-500 focus:border-cyan-300/35"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {smartSuggestions.map((suggestion) => (
                    <span key={suggestion} className="instant-feedback-chip">
                      {suggestion}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Visible Tools</p>
                  <p className="mt-3 text-4xl font-semibold text-slate-50">{activeCount}</p>
                  <p className="mt-2 text-sm text-slate-300/75">Filtered command set currently visible in the dashboard.</p>
                </div>
                <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Workspace Mode</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-50">Trusted + Separated</p>
                  <p className="mt-2 text-sm text-slate-300/75">Live verified workflows and guided range exercises are clearly labeled and routed separately.</p>
                </div>
                {categoryMetrics.map((metric) => {
                  const Icon = getToolIcon(
                    metric.label === "AI Tools"
                      ? "brain-circuit"
                      : metric.label === "Security Tools"
                        ? "shield-alert"
                        : metric.label === "Research Tools"
                          ? "globe-2"
                          : "graduation-cap"
                  );
                  return (
                    <button
                      key={metric.label}
                      type="button"
                      onClick={() => {
                        setActiveFilter(metric.label as ToolFilter);
                        trackAction({
                          type: "tools_filter",
                          tool: "tools",
                          query: metric.label,
                          depth: 1,
                          success: true,
                        }).catch(() => undefined);
                      }}
                      className={`rounded-[24px] border p-4 text-left transition-colors ${
                        activeFilter === metric.label
                          ? "border-cyan-300/35 bg-cyan-400/10"
                          : "border-white/10 bg-white/[0.03] hover:border-cyan-300/20 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-400/10 text-cyan-200">
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-100">{metric.label}</p>
                          <p className="text-xs text-slate-400">{metric.total} tools</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {toolsReady && recentTools.length ? (
            <section data-reveal className="app-smooth-enter flex flex-wrap items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/72">Recent Workspaces</span>
              {recentTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    setActiveFilter(tool.category === "Cybersecurity Tools" ? "Security Tools" : tool.category === "Research & OSINT Tools" ? "Research Tools" : tool.category === "Learning & Lab Tools" ? "Learning Tools" : "AI Tools");
                    setSearchTerm(tool.name);
                    trackAction({
                      type: "tools_resume_recent",
                      tool: "tools",
                      query: tool.name,
                      depth: 1,
                      success: true,
                    }).catch(() => undefined);
                  }}
                  className="tap-feedback rounded-full border border-cyan-300/15 bg-cyan-400/8 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-400/12"
                >
                  {tool.name}
                </button>
              ))}
            </section>
          ) : null}

          <section data-reveal className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-[26px] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(8,12,25,0.96),rgba(5,9,19,0.96))] p-5">
              <div className="inline-flex items-center gap-2 text-cyan-100">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-[11px] uppercase tracking-[0.24em]">Verified Live Tools</span>
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-50">{verifiedCount}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300/78">Operational workspaces for verified scans, trusted AI analysis, and evidence-based outputs.</p>
            </article>
            <article className="rounded-[26px] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(8,12,25,0.96),rgba(5,9,19,0.96))] p-5">
              <div className="inline-flex items-center gap-2 text-cyan-100">
                <BrainCircuit className="h-4 w-4" />
                <span className="text-[11px] uppercase tracking-[0.24em]">Learning Labs</span>
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-50">{learningCount}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300/78">Practice flows stay separate from live security operations to avoid mixed signals.</p>
            </article>
            <article className="rounded-[26px] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(8,12,25,0.96),rgba(5,9,19,0.96))] p-5">
              <div className="inline-flex items-center gap-2 text-cyan-100">
                <Shield className="h-4 w-4" />
                <span className="text-[11px] uppercase tracking-[0.24em]">Trust Policy</span>
              </div>
              <p className="mt-3 text-lg font-semibold text-slate-50">No fabricated scan output</p>
              <p className="mt-2 text-sm leading-6 text-slate-300/78">When verified evidence is unavailable, the hub should show `No verified data.` instead of fabricated findings.</p>
            </article>
          </section>

          <section data-reveal className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <article className="rounded-[26px] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(8,12,25,0.96),rgba(5,9,19,0.96))] p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/72">Access Control</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-50">Progressive unlock matrix</h2>
              <div className="mt-4 grid gap-3">
                <div className={`rounded-2xl border p-4 ${unlockedGates.intel_tools ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/[0.03] text-slate-300"}`}>
                  <p className="font-semibold">Intel tool access</p>
                  <p className="mt-1 text-xs">Unlock by completing a program day or touching 2 real labs.</p>
                </div>
                <div className={`rounded-2xl border p-4 ${unlockedGates.advanced_labs ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/[0.03] text-slate-300"}`}>
                  <p className="font-semibold">Advanced learning tools</p>
                  <p className="mt-1 text-xs">Unlock by earning the First Spark badge or holding a 2-day streak.</p>
                </div>
              </div>
            </article>

            <article className="rounded-[26px] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(8,12,25,0.96),rgba(5,9,19,0.96))] p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/72">Hidden Operator Challenge</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-50">{operatorOverride?.discovered ? operatorOverride.title : "Unknown mission"}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300/78">
                {operatorOverride?.discovered
                  ? operatorOverride.detail
                  : "There is a hidden access path in the tools hub. Layered progress and mission completion will expose it."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {!operatorOverride?.discovered ? (
                  <button type="button" className="tap-feedback rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs text-cyan-100" onClick={() => discoverHiddenChallenge("operator-override")}>
                    Reveal Clue
                  </button>
                ) : null}
                {operatorOverride?.unlocked && !operatorOverride.completed ? (
                  <button type="button" className="tap-feedback rounded-full border border-amber-300/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-100" onClick={() => completeHiddenChallenge("operator-override")}>
                    Claim Access Reward
                  </button>
                ) : null}
              </div>
            </article>
          </section>

          <section className="flex flex-wrap items-center gap-3">
            {TOOL_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => {
                  setActiveFilter(filter);
                  trackAction({
                    type: "tools_filter",
                    tool: "tools",
                    query: filter,
                    depth: 1,
                    success: true,
                  }).catch(() => undefined);
                }}
                className={`tap-feedback rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  activeFilter === filter
                    ? "border-cyan-300/35 bg-cyan-400/12 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/20 hover:text-slate-100"
                }`}
              >
                {filter}
              </button>
            ))}
          </section>

          <section className="space-y-5">
            {TOOL_GROUP_ORDER.map((group) => {
              const tools = groupedTools[group];
              if (!tools.length) return null;
              const groupMeta = TOOL_GROUP_META[group];
              const open = openGroups[group] ?? true;

              return (
                <section
                  key={group}
                  className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,25,0.96),rgba(5,9,19,0.96))] shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
                >
                  <div className="flex flex-col gap-4 border-b border-white/6 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/10 bg-cyan-400/8 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-cyan-100/75">
                        <Shield className="h-3.5 w-3.5" />
                        {groupMeta.eyebrow}
                      </div>
                      <div>
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-50">{group}</h2>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300/75">{groupMeta.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                        <Grid2x2 className="h-3.5 w-3.5 text-cyan-200/70" />
                        {tools.length} workspaces
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenGroups((current) => ({ ...current, [group]: !open }));
                          trackAction({
                            type: open ? "tools_group_collapse" : "tools_group_expand",
                            tool: "tools",
                            query: group,
                            depth: 1,
                            success: true,
                          }).catch(() => undefined);
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 transition-colors hover:border-cyan-300/20 hover:bg-white/[0.06]"
                      >
                        {open ? "Collapse" : "Expand"}
                        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {open ? (
                    <div className="stagger-grid grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-3 md:px-6 md:py-6">
                      {tools.map((tool) => (
                        <ToolCard key={tool.id} tool={tool} />
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ToolsPage;
