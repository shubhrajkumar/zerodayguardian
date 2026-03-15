import { useMemo, useState } from "react";
import { ChevronDown, Grid2x2, Search, Shield, Sparkles } from "lucide-react";
import ToolCard from "@/components/ToolCard";
import {
  TOOL_FILTERS,
  TOOL_GROUP_META,
  TOOL_GROUP_ORDER,
  getToolIcon,
  toolMatchesFilter,
  toolSearchIndex,
  toolsCatalog,
  type ToolFilter,
} from "@/lib/toolCatalog";

const ToolsPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<ToolFilter>("All Tools");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "AI Command": true,
    "Security Analysis": true,
    "Research & OSINT": true,
    "Learning & Lab": true,
  });

  const filteredTools = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return toolsCatalog.filter((tool) => {
      if (!toolMatchesFilter(tool, activeFilter)) return false;
      if (!query) return true;
      return toolSearchIndex(tool).includes(query);
    });
  }, [activeFilter, searchTerm]);

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
    []
  );

  const activeCount = filteredTools.length;

  return (
    <div className="page-shell bg-[#050816]">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="mx-auto max-w-7xl space-y-8">
          <section className="overflow-hidden rounded-[32px] border border-cyan-400/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_85%_18%,rgba(59,130,246,0.18),transparent_30%),linear-gradient(180deg,rgba(7,13,29,0.98),rgba(4,8,20,0.98))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.36)] md:p-8">
            <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/85">
                  <Sparkles className="h-3.5 w-3.5" />
                  Zero Day Guardian Tool Command
                </div>
                <div className="space-y-4">
                  <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-50 md:text-5xl">
                    Organized cybersecurity workspaces for AI, security analysis, research, and hands-on learning.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-slate-300/82">
                    The Tools section is now structured like a command center: searchable, filterable, grouped by mission,
                    and routed into dedicated workspaces instead of stacking everything into one crowded screen.
                  </p>
                </div>
                <div className="relative max-w-2xl">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/55" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search tools by keyword, capability, or workflow"
                    className="h-14 w-full rounded-2xl border border-cyan-300/15 bg-black/30 pl-12 pr-4 text-sm text-slate-100 outline-none ring-0 transition-colors placeholder:text-slate-500 focus:border-cyan-300/35"
                  />
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
                  <p className="mt-3 text-2xl font-semibold text-slate-50">Dedicated Interfaces</p>
                  <p className="mt-2 text-sm text-slate-300/75">Open any card to launch its own workspace without crowding the dashboard.</p>
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
                      onClick={() => setActiveFilter(metric.label as ToolFilter)}
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

          <section className="flex flex-wrap items-center gap-3">
            {TOOL_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
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
                        onClick={() => setOpenGroups((current) => ({ ...current, [group]: !open }))}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 transition-colors hover:border-cyan-300/20 hover:bg-white/[0.06]"
                      >
                        {open ? "Collapse" : "Expand"}
                        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {open ? (
                    <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-3 md:px-6 md:py-6">
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
