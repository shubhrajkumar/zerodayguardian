import { useState, useRef, useEffect } from "react";
import { safeArray } from "@/utils/safeData";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

interface OllamaChatProps {
  agentName?: string;
  apiEndpoint?: string;
  placeholder?: string;
  onSend?: (message: string) => Promise<string>;
}

export default function OllamaChat({
  agentName = "Zorvix AI",
  placeholder = "Ask Zorvix anything about cybersecurity...",
  onSend,
}: OllamaChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hello, I'm **${agentName}** — your cybersecurity AI assistant.\n\nI can help you with:\n- Threat analysis & vulnerability assessment\n- Security tool configuration\n- Code review & exploit analysis\n- Security best practices & training\n\n*How can I assist you today?*`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 150) + "px";
    }
  }, [input]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      let response = "I'm a local AI assistant. This is a sample response. Connect to an Ollama backend or implement the `onSend` prop to get real responses.\n\nFor now, here's a quick tip:\n\n```python\ndef scan_ports(target):\n    \"\"\"Scan common ports on target\"\"\"\n    import socket\n    open_ports = []\n    for port in [22, 80, 443, 8080, 3306, 5432]:\n        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)\n        sock.settimeout(1)\n        result = sock.connect_ex((target, port))\n        if result == 0:\n            open_ports.append(port)\n        sock.close()\n    return open_ports\n```\n\nThis function scans common ports on a target host. Let me know if you need help with specific security tasks!";

      if (onSend) {
        response = await onSend(trimmed);
      }

      // Simulate typing delay
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const renderMessage = (msg: Message) => {
    const isUser = msg.role === "user";

    return (
      <div
        key={msg.id}
        className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in-up`}
      >
        <div
          className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 ${
            isUser
              ? "bg-gradient-to-br from-[#00d4ff]/20 to-[#0099cc]/10 border border-[#00d4ff]/20 rounded-br-md"
              : "glass-card rounded-bl-md"
          }`}
          style={isUser ? {} : { borderColor: "var(--theme-border)" }}
        >
          {!isUser && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#00d4ff] to-[#7b2ff7] flex items-center justify-center text-[#0a0a0f] text-xs font-bold">
                Z
              </div>
              <span className="text-xs font-medium" style={{ color: "var(--theme-text-muted)" }}>{agentName}</span>
            </div>
          )}
          <div className="prose prose-invert prose-sm max-w-none message-content">
            {renderContent(msg.content, msg.id)}
          </div>
          <p className="text-[10px] mt-2 text-right" style={{ color: "var(--theme-text-dim)" }}>
            {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    );
  };

  const renderContent = (content: string, msgId: string) => {
    // Process code blocks
    const parts = content.split(/(```\w*\n[\s\S]*?```)/g);
    return parts.map((part, i) => {
      const codeMatch = part.match(/```(\w*)\n([\s\S]*?)```/);
      if (codeMatch) {
        const [, lang, code] = codeMatch;
        return (
          <div key={i} className="relative group my-3">
            {/* Code block header */}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-t-lg border border-b-0" style={{ backgroundColor: "var(--theme-bg)", borderColor: "var(--theme-border)" }}>
              <span className="text-[10px] font-mono" style={{ color: "var(--theme-text-dim)" }}>{lang || "code"}</span>
              <button
                onClick={() => copyToClipboard(code.trim(), `${msgId}-code-${i}`)}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-all hover:bg-[var(--theme-overlay)]"
                style={{ color: "var(--theme-text-dim)" }}
                aria-label={copiedId === `${msgId}-code-${i}` ? "Copied to clipboard" : "Copy code to clipboard"}
              >
                {copiedId === `${msgId}-code-${i}` ? (
                  <>✓ Copied</>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            {/* Code block */}
            <pre className="!mt-0 rounded-t-none rounded-b-lg p-4 overflow-x-auto" style={{ backgroundColor: "var(--theme-bg)", border: "1px solid var(--theme-border)" }}>
              <code className={`text-sm font-mono leading-relaxed ${lang ? `language-${lang}` : ""}`} style={{ color: "var(--theme-text)" }}>
                {code.trim()}
              </code>
            </pre>
          </div>
        );
      }
      // Handle inline code and markdown
      return (
        <div key={i} className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--theme-text)" }}>
          {renderInline(part)}
        </div>
      );
    });
  };

  const renderInline = (text: string) => {
    // Bold
    const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold" style={{ color: "var(--theme-text)" }}>{part.slice(2, -2)}</strong>;
      }
      // Inline code
      const codeParts = part.split(/(`[^`]+`)/g);
      return codeParts.map((cp, j) => {
        if (cp.startsWith("`") && cp.endsWith("`")) {
          return (
            <code key={`${i}-${j}`} className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ backgroundColor: "var(--theme-card)", color: "var(--theme-accent-blue)" }}>
              {cp.slice(1, -1)}
            </code>
          );
        }
        return <span key={`${i}-${j}`}>{cp}</span>;
      });
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {safeArray(messages).map(renderMessage)}

        {/* Quick prompts — shown when only the welcome message exists */}
        {messages.length === 1 && !isTyping && (
          <div className="flex flex-col items-start gap-2 animate-fade-in px-1">
            <p className="text-xs" style={{ color: "var(--theme-text-dim)" }}>Quick prompts:</p>
            <div className="flex flex-wrap gap-2">
              {[
                "What is SQL Injection?",
                "Explain network scanning",
                "How to start ethical hacking?",
                "What is OSINT?",
                "Explain XSS attacks",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:scale-[1.03]"
                  style={{
                    backgroundColor: "var(--theme-overlay)",
                    border: "1px solid var(--theme-border)",
                    color: "var(--theme-text-muted)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--theme-accent-blue)";
                    e.currentTarget.style.color = "var(--theme-accent-blue)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--theme-border)";
                    e.currentTarget.style.color = "var(--theme-text-muted)";
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {isTyping && (
          <div className="flex justify-start animate-fade-in">
            <div className="glass-card rounded-2xl rounded-bl-md p-4" style={{ borderColor: "var(--theme-border)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#00d4ff] to-[#7b2ff7] flex items-center justify-center text-[#0a0a0f] text-xs font-bold">
                  Z
                </div>
                <span className="text-xs font-medium" style={{ color: "var(--theme-text-muted)" }}>{agentName}</span>
              </div>
              <div className="flex items-center gap-1.5 py-1">
                <span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-typing-dot" />
                <span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-typing-dot" style={{ animationDelay: "0.2s" }} />
                <span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-typing-dot" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 px-4 pb-4 pt-2" style={{ background: "linear-gradient(to top, var(--theme-bg), color-mix(in srgb, var(--theme-bg) 95%, transparent), transparent)" }}>
        <div className="glass rounded-2xl p-2 flex items-end gap-2" style={{ border: "1px solid var(--theme-border)" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm px-2 py-2 max-h-[150px]"
            style={{ color: "var(--theme-text)" }}
            disabled={isTyping}
            aria-label={placeholder}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#0099cc] flex items-center justify-center text-[#0a0a0f] disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_15px_rgba(0,212,255,0.3)] transition-all"
            aria-label="Send message"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>          <p className="text-[10px] text-center mt-2" style={{ color: "var(--theme-text-dim)" }}>
          {agentName} may produce inaccurate information. Verify critical security findings.
        </p>
      </div>
    </div>
  );
}
