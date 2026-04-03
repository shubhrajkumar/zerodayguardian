import { Link } from "react-router-dom";
import { ArrowUpRight, BrainCircuit, ShieldCheck, Sparkles, Star } from "lucide-react";
import { sanitize } from "@/utils/sanitize";
import { getToolIcon, type ToolDefinition } from "@/lib/toolCatalog";

interface ToolCardProps {
  tool: ToolDefinition;
}

const ToolCard = ({ tool }: ToolCardProps) => {
  const Icon = getToolIcon(tool.icon);
  const isLearningWorkspace = tool.workspace === "lab" || tool.workspace === "learning";
  const trustLabel = isLearningWorkspace ? "Demo Learning Flow" : "Verified Live Workspace";
  const trustIcon = isLearningWorkspace ? BrainCircuit : ShieldCheck;
  const TrustIcon = trustIcon;
  const trustDescription = isLearningWorkspace
    ? "Guided practice is separated from live scans and verified operations."
    : "This workspace is intended for verified live data, operator review, and trusted outputs.";
  const rememberTool = () => {
    try {
      const raw = localStorage.getItem("tools:recent");
      const ids = raw ? (JSON.parse(raw) as number[]) : [];
      const next = [tool.id, ...ids.filter((id) => id !== tool.id)].slice(0, 8);
      localStorage.setItem("tools:recent", JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("tools:recent-updated"));
    } catch {
      // ignore local storage issues
    }
  };

  return (
    <article className="group premium-surface tool-card-premium app-smooth-enter relative flex h-full flex-col overflow-hidden rounded-[28px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(10,16,33,0.96),rgba(6,11,24,0.96))] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.36)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-[0_32px_90px_rgba(34,211,238,0.14)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent opacity-70" />
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-2">
          {tool.featured ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100">
              <Sparkles className="h-3 w-3" />
              Featured
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
            <Star className="h-3.5 w-3.5 text-amber-300" />
            {tool.rating.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">{sanitize(tool.category)}</p>
          <h3 className="text-xl font-semibold tracking-tight text-slate-50">{sanitize(tool.name)}</h3>
        </div>
        <p className="text-sm leading-6 text-slate-300/82">{sanitize(tool.description)}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-100 inline-flex items-center gap-1.5">
          <TrustIcon className="h-3.5 w-3.5" />
          {trustLabel}
        </span>
        {(tool.capabilities || []).slice(0, 2).map((capability) => (
          <span
            key={capability}
            className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300/80"
          >
            {sanitize(capability)}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-6">
        <div className="mb-4 h-px w-full bg-gradient-to-r from-cyan-300/20 via-white/10 to-transparent" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Workspace</p>
            <p className="text-sm text-slate-200">{sanitize(tool.group)}</p>
            <p className="mt-1 max-w-[16rem] text-xs leading-5 text-slate-400">{trustDescription}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/tools/${tool.id}`}
              onClick={rememberTool}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-400/16"
            >
              {isLearningWorkspace ? "Open Lab" : "Launch"}
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
};

export default ToolCard;
