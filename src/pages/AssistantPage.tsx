import { useNavigate } from "react-router-dom";
import Zorvix from "@/components/Zorvix";

export default function AssistantPage() {
  const navigate = useNavigate();

  return (
    <div className="relative h-[calc(100vh-4rem)] md:h-screen flex flex-col" style={{ backgroundColor: "var(--theme-bg)" }}>
      {/* Back navigation — floating above the chat */}
      <button
        onClick={() => navigate("/dashboard")}
        className="fixed top-20 left-4 z-50 btn-cyber-ghost p-2 rounded-lg backdrop-blur"
        aria-label="Back to dashboard"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Full-screen ZORVIX chat */}
      <div className="flex-1 overflow-hidden">
        <Zorvix fullScreen />
      </div>
    </div>
  );
}
