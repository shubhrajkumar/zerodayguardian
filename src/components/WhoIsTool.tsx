import { useState } from "react";
import { Loader2, Search, Terminal } from "lucide-react";

type RdapEntity = {
  handle?: string;
  roles?: string[];
  vcardArray?: [string, unknown[][]];
  entities?: RdapEntity[];
};

type RdapEvent = {
  eventAction: string;
  eventDate: string;
};

type RdapResponse = {
  objectClassName?: string;
  handle?: string;
  ldhName?: string;
  links?: Array<{ value: string; rel: string; href: string }>;
  status?: string[];
  entities?: RdapEntity[];
  events?: RdapEvent[];
  nameservers?: Array<{ ldhName: string }>;
  secureDNS?: { delegationSigned?: boolean };
  port43?: string;
  notices?: Array<{ title: string; description: string[] }>;
  rdapConformance?: string[];
  [key: string]: unknown;
};

type Entry = { label: string; value: string };

/** Extract a field from a jCard (vCard JSON) array. */
const getVcardField = (vcard: [string, unknown[][]], field: string): string | null => {
  if (!Array.isArray(vcard[1])) return null;
  for (const item of vcard[1]) {
    if (Array.isArray(item) && item[0] === field && typeof item[3] === "string") {
      return item[3];
    }
  }
  return null;
};

/** Recursively find the first entity with a given role and extract its vcard field. */
const findEntityValue = (entities: RdapEntity[] | undefined, role: string, field: string): string | null => {
  if (!entities) return null;
  for (const entity of entities) {
    if (entity.roles?.includes(role) && entity.vcardArray) {
      const val = getVcardField(entity.vcardArray, field);
      if (val) return val;
    }
    const nested = findEntityValue(entity.entities, role, field);
    if (nested) return nested;
  }
  return null;
};

/** Get the latest event date for a given action type. */
const getEventDate = (events: RdapEvent[] | undefined, action: string): string | null => {
  if (!events?.length) return null;
  const match = events.find((e) => e.eventAction === action);
  return match?.eventDate ? new Date(match.eventDate).toISOString().slice(0, 10) : null;
};

/** Try to get a vcard field from the top-level registrar entity. */
const getRegistrarField = (entities: RdapEntity[] | undefined, field: string): string | null => {
  if (!entities) return null;
  // First try the "registrar" role
  const registrar = findEntityValue(entities, "registrar", field);
  if (registrar) return registrar;
  // Fall back to any entity with a vcard containing this field
  for (const entity of entities) {
    if (entity.vcardArray) {
      const val = getVcardField(entity.vcardArray, field);
      if (val) return val;
    }
  }
  return null;
};

export default function WhoIsTool() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [rdapData, setRdapData] = useState<RdapResponse | null>(null);
  const [error, setError] = useState("");

  const lookup = async () => {
    let target = domain.trim().toLowerCase();
    if (!target) return;
    // Strip protocol, www., trailing slashes, and path
    target = target.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").replace(/\s/g, "");

    setLoading(true);
    setError("");
    setRdapData(null);

    try {
      const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(target)}`);
      if (!res.ok) {
        if (res.status === 429) {
          setError("[!] ERROR: Rate limit reached. Wait a moment and retry.");
        } else if (res.status === 404) {
          setError("[!] ERROR: Domain not found in registry.");
        } else {
          setError("[!] ERROR: Uplink rejected target structure.");
        }
        return;
      }
      const data: RdapResponse = await res.json();
      if (!data || data.objectClassName !== "domain") {
        setError("[!] ERROR: Uplink rejected target structure.");
        return;
      }
      setRdapData(data);
    } catch {
      setError("[!] ERROR: Uplink rejected target structure.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) lookup();
  };

  const entries: Entry[] = rdapData
    ? [
        { label: "Domain", value: rdapData.ldhName || rdapData.handle || "--" },
        { label: "Status", value: rdapData.status?.join(", ") || "--" },
        { label: "Registrar", value: getRegistrarField(rdapData.entities, "fn") || "--" },
        { label: "Registrant", value: findEntityValue(rdapData.entities, "registrant", "fn") || "--" },
        { label: "Organization", value: findEntityValue(rdapData.entities, "registrant", "org") || getRegistrarField(rdapData.entities, "org") || "--" },
        { label: "Created", value: getEventDate(rdapData.events, "registration") || "--" },
        { label: "Updated", value: getEventDate(rdapData.events, "last changed") || getEventDate(rdapData.events, "last update of RDAP database") || "--" },
        { label: "Expires", value: getEventDate(rdapData.events, "expiration") || "--" },
        { label: "Name Servers", value: rdapData.nameservers?.map((ns) => ns.ldhName).join(", ") || "--" },
        { label: "DNSSEC", value: rdapData.secureDNS?.delegationSigned ? "Yes" : "--" },
      ]
    : [];

  return (
    <div className="terminal-card overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.5)]" />
          <div>
            <h2 className="text-sm font-bold text-slate-100">WHOIS / RDAP</h2>
            <p className="font-mono text-[10px] text-slate-500 mt-0.5">// Query domain registration records</p>
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
          className="h-12 w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-40 pr-4 font-mono text-sm text-slate-100 placeholder-slate-600 transition-all duration-200 focus:border-violet-500/50 focus:shadow-[0_0_12px_rgba(167,139,250,0.08)] focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={lookup}
        disabled={loading || !domain.trim()}
        className="h-10 w-full rounded-lg bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-300 px-4 text-xs font-bold text-slate-950 shadow-[0_8px_24px_rgba(167,139,250,0.2)] transition hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            QUERYING REGISTRY...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Search className="h-4 w-4" />
            LOOKUP DOMAIN
          </span>
        )}
      </button>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3">
          <p className="font-mono text-xs text-rose-300/90">{error}</p>
        </div>
      ) : null}

      {rdapData ? (
        <div className="mt-4 rounded-lg border border-violet-500/20 bg-slate-950/80 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-violet-400" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-violet-400/80">
              src/registry/rdap.json
            </span>
          </div>
          <div className="space-y-1.5 font-mono text-xs">
            {entries.map((entry) => (
              <div
                key={entry.label}
                className="flex flex-wrap items-baseline gap-2 rounded px-2 py-1 transition-colors hover:bg-violet-500/5"
              >
                <span className="w-28 shrink-0 text-violet-400/60">{entry.label}:</span>
                <span className="break-all text-violet-200/90">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!rdapData && !error ? (
        <p className="mt-3 font-mono text-[10px] text-slate-600">
          {">"} Enter a domain (without http://) to query RDAP registration data.
        </p>
      ) : null}
    </div>
  );
}
