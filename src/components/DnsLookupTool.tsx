import { useState } from "react";
import { Loader2, Search, Terminal } from "lucide-react";

type DnsRecordType =
  | "A"
  | "AAAA"
  | "MX"
  | "NS"
  | "TXT"
  | "CNAME"
  | "SOA";

const RECORD_TYPES: { id: DnsRecordType; label: string }[] = [
  { id: "A", label: "A" },
  { id: "AAAA", label: "AAAA" },
  { id: "MX", label: "MX" },
  { id: "NS", label: "NS" },
  { id: "TXT", label: "TXT" },
  { id: "CNAME", label: "CNAME" },
  { id: "SOA", label: "SOA" },
];

type DnsAnswer = {
  name: string;
  type: number;
  TTL: number;
  data: string;
};

type DnsResponse = {
  Status: number;
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question: Array<{ name: string; type: number }>;
  Answer?: DnsAnswer[];
  Authority?: DnsAnswer[];
  Comment?: string;
};

/** Map DNS numeric type codes to human-readable names. */
const TYPE_NAMES: Record<number, string> = {
  1: "A",
  5: "CNAME",
  6: "SOA",
  15: "MX",
  16: "TXT",
  28: "AAAA",
  33: "SRV",
  46: "RRSIG",
  47: "NSEC",
  48: "DNSKEY",
  257: "CAA",
};

const getTypeName = (code: number): string => TYPE_NAMES[code] || `TYPE${code}`;

const STATUS_LABELS: Record<number, string> = {
  0: "NOERROR",
  1: "FORMERR",
  2: "SERVFAIL",
  3: "NXDOMAIN",
  4: "NOTIMP",
  5: "REFUSED",
};

export default function DnsLookupTool() {
  const [domain, setDomain] = useState("");
  const [recordType, setRecordType] = useState<DnsRecordType>("A");
  const [loading, setLoading] = useState(false);
  const [dnsData, setDnsData] = useState<DnsResponse | null>(null);
  const [error, setError] = useState("");

  const lookup = async () => {
    let target = domain.trim().toLowerCase();
    if (!target) return;
    // Strip protocol, www., trailing slashes, and path
    target = target.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").replace(/\s/g, "");

    setLoading(true);
    setError("");
    setDnsData(null);

    try {
      const res = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(target)}&type=${recordType}`
      );
      if (!res.ok) {
        setError("[!] ERROR: Uplink rejected target structure.");
        return;
      }
      const data: DnsResponse = await res.json();

      // NXDOMAIN or other non-success status
      if (data.Status !== 0) {
        const label = STATUS_LABELS[data.Status] || `CODE${data.Status}`;
        if (data.Status === 3) {
          setError("[!] ERROR: Domain does not exist (NXDOMAIN).");
        } else {
          setError(`[!] ERROR: DNS query returned ${label}.`);
        }
        return;
      }

      if (!data.Answer?.length && !data.Authority?.length) {
        setError("[!] No records found for this query.");
        return;
      }

      setDnsData(data);
    } catch {
      setError("[!] ERROR: Uplink rejected target structure.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) lookup();
  };

  const allAnswers = [...(dnsData?.Answer || []), ...(dnsData?.Authority || [])];

  return (
    <div className="terminal-card overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.5)]" />
          <div>
            <h2 className="text-sm font-bold text-slate-100">DNS LOOKUP</h2>
            <p className="font-mono text-[10px] text-slate-500 mt-0.5">// Query DNS records via Google Public DNS</p>
          </div>
        </div>
      </div>

      <div className="relative mb-4">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-rose-400/70">
          [TARGET DOMAIN]
        </span>
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ENTER DOMAIN (e.g., example.com)"
          className="h-12 w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-40 pr-4 font-mono text-sm text-slate-100 placeholder-slate-600 transition-all duration-200 focus:border-sky-500/50 focus:shadow-[0_0_12px_rgba(56,189,248,0.08)] focus:outline-none"
        />
      </div>

      {/* Record type selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {RECORD_TYPES.map((rt) => (
          <button
            key={rt.id}
            type="button"
            onClick={() => setRecordType(rt.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold font-mono tracking-wider transition ${
              recordType === rt.id
                ? "bg-sky-400/20 text-sky-100 ring-1 ring-sky-300/40"
                : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
            }`}
          >
            {rt.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={lookup}
        disabled={loading || !domain.trim()}
        className="h-10 w-full rounded-lg bg-gradient-to-r from-sky-400 via-cyan-400 to-teal-300 px-4 text-xs font-bold text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.2)] transition hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            RESOLVING DNS...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Search className="h-4 w-4" />
            QUERY DNS
          </span>
        )}
      </button>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3">
          <p className="font-mono text-xs text-rose-300/90">{error}</p>
        </div>
      ) : null}

      {dnsData ? (
        <div className="mt-4 rounded-lg border border-sky-500/20 bg-slate-950/80 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-sky-400" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-sky-400/80">
              src/resolve/dns.json
            </span>
          </div>

          {/* Summary line */}
          <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-mono text-slate-500">
            <span>Status: {STATUS_LABELS[dnsData.Status] || `CODE${dnsData.Status}`}</span>
            <span>•</span>
            <span>Records: {allAnswers.length}</span>
            {dnsData.RA ? <><span>•</span><span>Recursion available</span></> : null}
          </div>

          {/* Results table header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-sky-500/10 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-sky-400/60">
            <span>Name</span>
            <span>Type</span>
            <span className="text-right">TTL</span>
          </div>

          <div className="mt-1 max-h-64 space-y-0.5 overflow-y-auto">
            {allAnswers.map((answer, i) => (
              <div
                key={`${answer.name}-${answer.type}-${i}`}
                className="grid grid-cols-[1fr_auto_auto] gap-2 rounded px-2 py-1 text-xs font-mono transition-colors hover:bg-sky-500/5"
              >
                <span className="truncate text-sky-200/90" title={answer.data}>
                  {answer.name}
                </span>
                <span className="shrink-0 text-sky-400/60">{getTypeName(answer.type)}</span>
                <span className="shrink-0 text-right text-sky-400/40">{answer.TTL}s</span>
              </div>
            ))}
          </div>

          {/* Data values for each record */}
          <div className="mt-3 space-y-1.5 border-t border-sky-500/10 pt-3">
            {allAnswers.map((answer, i) => (
              <div
                key={`data-${answer.name}-${answer.type}-${i}`}
                className="flex items-baseline gap-2 rounded px-2 py-1 text-xs font-mono transition-colors hover:bg-sky-500/5"
              >
                <span className="shrink-0 text-sky-400/60">{getTypeName(answer.type)}</span>
                <span className="break-all text-sky-200/90">{answer.data}</span>
              </div>
            ))}
          </div>

          {dnsData.Comment ? (
            <p className="mt-3 text-[10px] font-mono text-slate-500">{dnsData.Comment}</p>
          ) : null}
        </div>
      ) : null}

      {!dnsData && !error ? (
        <p className="mt-3 font-mono text-[10px] text-slate-600">
          {">"} Select a record type and enter a domain to resolve DNS records.
        </p>
      ) : null}
    </div>
  );
}
