import { useState } from "react";
import { Loader2, Search, Terminal, Copy, Check, Globe } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

type SubdomainResponse = {
  status: string;
  domain: string;
  total: number;
  subdomains: string[];
  message?: string;
};

const API_PATH = "/api/tools/subdomains";

export default function SubdomainTool() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [subData, setSubData] = useState<SubdomainResponse | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const lookup = async () => {
    let target = domain.trim().toLowerCase();
    if (!target) return;

    // Normalize
    target = target
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .replace(/\s/g, "");

    setLoading(true);
    setError("");
    setSubData(null);

    try {
      const res = await apiFetch(
        `${API_PATH}?domain=${encodeURIComponent(target)}`
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

      const data: SubdomainResponse = await res.json();

      if (data.total === 0 && data.message) {
        setError(`[!] ${data.message}`);
        return;
      }

      setSubData(data);
    } catch {
      setError("[!] ERROR: Uplink rejected target structure.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) lookup();
  };

  const copyAll = () => {
    if (!subData?.subdomains) return;
    navigator.clipboard.writeText(subData.subdomains.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="terminal-card overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.5)]" />
          <div>
            <h2 className="text-sm font-bold text-slate-100">SUBDOMAIN ENUM</h2>
            <p className="font-mono text-[10px] text-slate-500 mt-0.5">
              // Discover subdomains via Certificate Transparency logs
            </p>
          </div>
        </div>
      </div>

      <div className="relative mb-4">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-teal-400/70">
          [TARGET DOMAIN]
        </span>
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ENTER DOMAIN (e.g., example.com)"
          className="h-12 w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-36 pr-4 font-mono text-sm text-slate-100 placeholder-slate-600 transition-all duration-200 focus:border-teal-500/50 focus:shadow-[0_0_12px_rgba(45,212,191,0.08)] focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={lookup}
        disabled={loading || !domain.trim()}
        className="h-10 w-full rounded-lg bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-300 px-4 text-xs font-bold text-slate-950 shadow-[0_8px_24px_rgba(45,212,191,0.2)] transition hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            QUERYING CT LOGS...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Search className="h-4 w-4" />
            ENUMERATE SUBDOMAINS
          </span>
        )}
      </button>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3">
          <p className="font-mono text-xs text-rose-300/90">{error}</p>
        </div>
      ) : null}

      {subData ? (
        <div className="mt-4 rounded-lg border border-teal-500/20 bg-slate-950/80 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-teal-400" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-teal-400/80">
              src/enum/{subData.domain}.txt
            </span>
          </div>

          {/* Summary */}
          <div className="mb-3 flex flex-wrap gap-3 text-[10px] font-mono">
            <span className="text-slate-500">
              Domain:{" "}
              <span className="text-slate-300">{subData.domain}</span>
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-500">
              Subdomains:{" "}
              <span className="text-teal-300 font-semibold">
                {subData.total}
              </span>
            </span>
          </div>

          {/* Subdomain list */}
          <div className="mt-3 max-h-96 space-y-0.5 overflow-y-auto rounded-lg border border-teal-500/10 bg-black/30 p-3">
            {subData.subdomains.length > 0 ? (
              subData.subdomains.map((sub, i) => (
                <div
                  key={`${sub}-${i}`}
                  className="flex items-center gap-2 rounded px-2 py-1 text-xs font-mono transition-colors hover:bg-teal-500/5"
                >
                  <Globe className="h-3 w-3 shrink-0 text-teal-400/60" />
                  <span className="break-all text-slate-200/90">{sub}</span>
                </div>
              ))
            ) : (
              <p className="text-xs font-mono text-slate-500">
                No subdomains discovered.
              </p>
            )}
          </div>

          {/* Copy button */}
          {subData.subdomains.length > 0 ? (
            <div className="mt-3 flex justify-end border-t border-teal-500/10 pt-3">
              <button
                type="button"
                onClick={copyAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-mono text-slate-400 transition hover:border-teal-300/30 hover:text-teal-300"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    COPIED
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    COPY ALL ({subData.total})
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!subData && !error ? (
        <p className="mt-3 font-mono text-[10px] text-slate-600">
          {">"} Enter a domain to discover subdomains from Certificate
          Transparency logs.
        </p>
      ) : null}
    </div>
  );
}
