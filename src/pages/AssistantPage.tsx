import { useNavigate } from "react-router-dom";
import OllamaChat from "@/components/OllamaChat";
import AnimatedCyberBackground from "@/components/AnimatedCyberBackground";

export default function AssistantPage() {
  const navigate = useNavigate();

  return (
    <div className="relative h-[calc(100vh-4rem)] md:h-screen flex flex-col" style={{ backgroundColor: "var(--theme-bg)" }}>
      <AnimatedCyberBackground />

      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b border-[#2a2a3e] px-4 md:px-6">
        <div className="flex items-center justify-between h-14 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="btn-cyber-ghost p-1.5 -ml-1.5"
              aria-label="Back to dashboard"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#7b2ff7] flex items-center justify-center text-[#0a0a0f] font-bold text-sm shadow-lg shadow-[#00d4ff]/20">
                Z
              </div>
              <div>
                <h1 className="text-sm font-semibold text-[#e0e0f0]">Zorvix AI</h1>
                <p className="text-[10px] text-[#555577]">Cybersecurity Assistant</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
              <span className="text-[10px] text-[#00ff88] font-medium">Online</span>
            </span>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full overflow-hidden">
        <OllamaChat
          agentName="Zorvix AI"
          placeholder="Ask about threats, tools, exploits, or security best practices..."
        />
      </div>
    </div>
  );
}
