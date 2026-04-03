import { startTransition } from "react";
import { useNavigate } from "react-router-dom";
import { useMissionSystem } from "@/context/MissionSystemApiContext";

const MissionRail = () => {
  const navigate = useNavigate();
  const { rails } = useMissionSystem();

  return (
    <section data-reveal className="grid gap-4 xl:grid-cols-4">
      {rails.map((track) => (
        <button
          key={track.id}
          type="button"
          onClick={() => startTransition(() => navigate(track.route))}
          className="premium-card-lift premium-sheen rounded-[26px] border border-cyan-300/14 bg-black/30 p-5 text-left backdrop-blur-md transition hover:-translate-y-0.5 hover:border-cyan-300/26 hover:bg-cyan-500/6"
        >
          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/62">{track.level} rail</p>
          <h3 className="mt-3 text-xl font-bold text-white">{track.title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300/80">{track.objective}</p>
          <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-xs">
            <p className="text-cyan-100/72">Deploy mode</p>
            <p className="mt-1 text-slate-100">{track.mode}</p>
            <p className="mt-3 text-cyan-100/72">Intel payoff</p>
            <p className="mt-1 text-slate-300/78">{track.payoff}</p>
            <p className="mt-3 text-cyan-100/72">Breach status</p>
            <p className="mt-1 text-slate-100">{track.progressLabel}</p>
          </div>
        </button>
      ))}
    </section>
  );
};

export default MissionRail;
