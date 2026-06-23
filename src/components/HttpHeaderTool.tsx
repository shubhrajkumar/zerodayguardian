import { useState } from "react";
import { Loader2, Search, Terminal, Copy, Check, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

type HeaderCategories = {
  security: Record<string, string>;
  cache: Record<string, string>;
  content: Record<string, string>;
  cors: Record<string, string>;
  other: Record<string, string>;
};

type HeaderResponse = {
  status: string;
  url: string;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  headerCount: number;
  categories: HeaderCategories;
  security: {
    score: number;
    present: string[];
    missing: string[];
    total: number;
    found: number;
  };
};

const API_PATH = "/api/tools/headers";

const CATEGORY_LABELS: Record<keyof HeaderCategories, string> = {
  security: "SECURITY",
  cache: "CACHE",
  content: "CONTENT",
  cors: "CORS",
  other: "OTHER",
};

const CATEGORY_COLORS: Record<keyof HeaderCategories, string> = {
  security: "bg-emerald-400",
  cache: "bg-amber-400",
  content: "bg-blue-400",
  cors: "bg-violet-400",
  other: "bg-slate-400",
};

const getScoreColor = (score: number): string => {
  if (score >= 75) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
};

const getScoreBg = (score: number): string => {
  if (score >= 75) return "bg-emerald-400/10 border-emerald-400/20";
  if (score >= 40) return "bg-amber-400/10 border-amber-400/20";
  return "bg-rose-400/10 border-rose-400/20";
};

export default function HttpHeaderTool() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [headerData, setHeaderData] = useState<HeaderResponse | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const lookup = async () => {
    let target = url.trim();
    if (!target) return;

    // Auto-prepend https:// if no protocol
    if (!/^https?:\/\//i.test(target)) {
      target = `https://${target}`;
    }

    setLoading(true);
    setError("");
    setHeaderData(null);

    try {
      const res = await apiFetch(
        `${API_PATH}?url=${encodeURIComponent(target)}`
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body?.error
            ? `[!] ERROR: ${body.error}`
            : "[!] ERROR: Uplink rejected target structure."
        );
        return;
      }

      const data: HeaderResponse = await res.json();
      setHeaderData(data);
    } catch {
      setError("[!] ERROR: Uplink rejected target structure.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) lookup();
  };

  const copyHeaders = () => {
    if (!headerData) return;
    const lines = Object.entries(headerData.headers).map(
      ([key, value]) => `${key}: ${value}`
    );
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const categories: (keyof HeaderCategories)[] = [
    "security",
    "cache",
    "content",
    "cors",
    "other",
  ];

  return (
    <div className="terminal-card overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.5)]" />
          <div>
            <h2 className="text-sm font-bold text-slate-100">HTTP HEADER INSPECTOR</h2>
            <p className="font-mono text-[10px] text-slate-500 mt-0.5">
              // Fetch and analyze HTTP response headers
            </p>
          </div>
        </div>
      </div>

      <div className="relative mb-4">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-orange-400/70">
          [TARGET URL]
        </span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ENTER URL (e.g., https://example.com)"
          className="h-12 w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-28 pr-4 font-mono text-sm text-slate-100 placeholder-slate-600 transition-all duration-200 focus:border-orange-500/50 focus:shadow-[0_0_12px_rgba(251,146,60,0.08)] focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={lookup}
        disabled={loading || !url.trim()}
        className="h-10 w-full rounded-lg bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300 px-4 text-xs font-bold text-slate-950 shadow-[0_8px_24px_rgba(251,146,60,0.2)] transition hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            FETCHING HEADERS...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Search className="h-4 w-4" />
            INSPECT HEADERS
          </span>
        )}
      </button>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3">
          <p className="font-mono text-xs text-rose-300/90">{error}</p>
        </div>
      ) : null}

      {headerData ? (
        <div className="mt-4 space-y-4">
          {/* Terminal header */}
          <div className="rounded-lg border border-orange-500/20 bg-slate-950/80 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-orange-400" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-orange-400/80">
                src/headers/headers.txt
              </span>
            </div>

            {/* Summary bar */}
            <div className="mb-3 flex flex-wrap gap-3 text-[10px] font-mono">
              <span className="text-slate-500">
                URL:{" "}
                <span className="text-slate-300 break-all">{headerData.url}</span>
              </span>
              <span className="text-slate-500">•</span>
              <span
                className={`font-semibold ${
                  headerData.statusCode < 300
                    ? "text-emerald-400"
                    : headerData.statusCode < 400
                      ? "text-amber-400"
                      : "text-rose-400"
                }`}
              >
                {headerData.statusCode} {headerData.statusText}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-500">
                {headerData.headerCount} headers
              </span>
            </div>

            {/* Security score */}
            <div
              className={`mb-4 flex items-center gap-3 rounded-lg border p-3 ${getScoreBg(headerData.security.score)}`}
            >
              {headerData.security.score >= 75 ? (
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              ) : headerData.security.score >= 40 ? (
                <ShieldAlert className="h-5 w-5 text-amber-400" />
              ) : (
                <Shield className="h-5 w-5 text-rose-400" />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    Security Posture
                  </span>
                  <span
                    className={`text-xs font-bold font-mono ${getScoreColor(headerData.security.score)}`}
                  >
                    {headerData.security.score}%
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {headerData.security.present.length > 0 ? (
                    <span className="text-[10px] text-emerald-400/80">
                      +{headerData.security.present.length} present
                    </span>
                  ) : null}
                  {headerData.security.missing.length > 0 ? (
                    <span className="text-[10px] text-rose-400/80">
                      -{headerData.security.missing.length} missing
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Categorized headers */}
            <div className="space-y-3">
              {categories.map((cat) => {
                const entries = Object.entries(headerData.categories[cat]);
                if (entries.length === 0) return null;

                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${CATEGORY_COLORS[cat]}`}
                      />
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
                        {CATEGORY_LABELS[cat]}
                      </span>
                      <span className="text-[10px] font-mono text-slate-600">
                        ({entries.length})
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {entries.map(([key, value]) => (
                        <div
                          key={key}
                          className="grid grid-cols-[auto_1fr] gap-2 rounded px-2 py-1 text-xs font-mono transition-colors hover:bg-orange-500/5"
                        >
                          <span className="shrink-0 text-orange-400/70 min-w-[160px]">
                            {key}
                          </span>
                          <span className="break-all text-slate-300/90">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Missing security headers */}
            {headerData.security.missing.length > 0 ? (
              <div className="mt-4 rounded-lg border border-rose-500/10 bg-rose-500/5 p-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <ShieldAlert className="h-3 w-3 text-rose-400" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-rose-400/80">
                    MISSING SECURITY HEADERS
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {headerData.security.missing.map((h) => (
                    <span
                      key={h}
                      className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-mono text-rose-300/80"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Copy button */}
            <div className="mt-3 flex justify-end border-t border-orange-500/10 pt-3">
              <button
                type="button"
                onClick={copyHeaders}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-mono text-slate-400 transition hover:border-orange-300/30 hover:text-orange-300"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    COPIED
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    COPY ALL HEADERS
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!headerData && !error ? (
        <p className="mt-3 font-mono text-[10px] text-slate-600">
          {">"} Enter a URL to inspect its HTTP response headers.
        </p>
      ) : null}
    </div>
  );
}
