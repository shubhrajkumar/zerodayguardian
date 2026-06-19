import { useState } from "react";
import { Globe2, Loader2, Terminal } from "lucide-react";

type GeoData = {
  ip: string;
  city: string;
  region: string;
  country_name: string;
  country: string;
  latitude: number;
  longitude: number;
  org: string;
  asn: string;
  isp: string;
  timezone: string;
  currency: string;
  [key: string]: unknown;
};

type Entry = { label: string; value: string };

export default function IpGeolocationTool() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [geoData, setGeoData] = useState<GeoData | null>(null);
  const [error, setError] = useState("");

  const lookup = async () => {
    const target = input.trim();
    if (!target) return;

    setLoading(true);
    setError("");
    setGeoData(null);

    try {
      const res = await fetch(`https://ipapi.co/${encodeURIComponent(target)}/json/`);
      if (!res.ok) {
        setError("[!] ERROR: Uplink rejected target structure.");
        return;
      }
      const data: GeoData = await res.json();
      if (data.error) {
        setError("[!] ERROR: Uplink rejected target structure.");
        return;
      }
      setGeoData(data);
    } catch {
      setError("[!] ERROR: Uplink rejected target structure.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) lookup();
  };

  const entries: Entry[] = geoData
    ? [
        { label: "IP Address", value: geoData.ip },
        { label: "Country", value: `${geoData.country_name} (${geoData.country})` },
        { label: "City", value: geoData.city },
        { label: "Region", value: geoData.region },
        { label: "ISP", value: geoData.isp || geoData.org },
        { label: "ASN", value: geoData.asn },
        { label: "Latitude", value: String(geoData.latitude) },
        { label: "Longitude", value: String(geoData.longitude) },
        { label: "Timezone", value: geoData.timezone },
        { label: "Currency", value: geoData.currency },
      ]
    : [];

  return (
    <div className="terminal-card overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]" />
          <div>
            <h2 className="text-sm font-bold text-slate-100">IP GEOLOCATION</h2>
            <p className="font-mono text-[10px] text-slate-500 mt-0.5">// Resolve IP address intelligence</p>
          </div>
        </div>
      </div>

      <div className="relative mb-4">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-rose-400/70">
          [TARGET INGRESS]
        </span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ENTER IP/DOMAIN"
          className="h-12 w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-36 pr-4 font-mono text-sm text-slate-100 placeholder-slate-600 transition-all duration-200 focus:border-cyan-500/50 focus:shadow-[0_0_12px_rgba(34,211,238,0.08)] focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={lookup}
        disabled={loading || !input.trim()}
        className="h-10 w-full rounded-lg bg-gradient-to-r from-cyan-400 via-sky-400 to-amber-300 px-4 text-xs font-bold text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.2)] transition hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            PINGING SATELLITE...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Globe2 className="h-4 w-4" />
            TRACK IP
          </span>
        )}
      </button>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3">
          <p className="font-mono text-xs text-rose-300/90">{error}</p>
        </div>
      ) : null}

      {geoData ? (
        <div className="mt-4 rounded-lg border border-emerald-500/20 bg-slate-950/80 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-400/80">
              src/resolve/geo.json
            </span>
          </div>
          <div className="space-y-1.5 font-mono text-xs">
            {entries.map((entry) => (
              <div
                key={entry.label}
                className="flex flex-wrap items-baseline gap-2 rounded px-2 py-1 transition-colors hover:bg-emerald-500/5"
              >
                <span className="w-24 shrink-0 text-emerald-400/60">{entry.label}:</span>
                <span className="break-all text-emerald-200/90">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!geoData && !error ? (
        <p className="mt-3 font-mono text-[10px] text-slate-600">
          {">"} Enter an IPv4 address to begin reconnaissance.
        </p>
      ) : null}
    </div>
  );
}
