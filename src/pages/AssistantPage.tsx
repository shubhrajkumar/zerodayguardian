import { useNavigate } from "react-router-dom";
import AIMentor from "@/components/mentor/AIMentor";

export default function AssistantPage() {
  const navigate = useNavigate();

  return (
    <div className="relative h-[calc(100vh-4rem)] md:h-screen flex flex-col" style={{ backgroundColor: "var(--theme-bg)" }}>
      {/* Back navigation — desktop icon-only */}
      <button
        onClick={() => navigate("/dashboard")}
        className="hidden md:inline-flex fixed top-20 left-4 z-50 btn-cyber-ghost p-2 rounded-lg backdrop-blur"
        aria-label="Back to dashboard"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Back navigation — mobile with label */}
      <button
        onClick={() => navigate("/dashboard")}
        className="md:hidden fixed top-20 left-4 z-50 inline-flex items-center gap-1 rounded-lg border border-white/8 bg-[var(--theme-bg)]/90 backdrop-blur px-3 py-1.5 text-xs text-slate-400"
        aria-label="Back to dashboard"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Dashboard
      </button>

      {/* Full-screen AI Mentor with ZORVIX chat, goals, skills, roadmap, progress */}
      <div className="flex-1 overflow-hidden">
        <AIMentor />
      </div>
    </div>
  );
}
