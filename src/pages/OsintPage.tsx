/**
 * OsintPage — OSINT Command Center & Intelligence Matrix
 *
 * Asymmetric 3-column tactical dashboard:
 *   Left:   Threat Feeds & Intel Streams (live cyber updates)
 *   Center: Live OSINT Workflows/Tools (existing 8 tool modes + workflow panels)
 *   Right:  Practical Resources & OSINT Hub
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Globe,
  Search,
  Shield,
  Upload,
  User,
  TerminalSquare,
  FileText,
  BookOpen,
  Target,
  Zap,
  ChevronRight,
  Info,
} from "lucide-react";
import { getStoredAccessToken, apiGetJson } from "@/lib/apiClient";
import api from "@/lib/api";
import { getPyApiUserMessage, pyPostJson, resolvePublicPyApiUrl } from "@/lib/pyApiClient";
import IpGeolocationTool from "@/components/IpGeolocationTool";
import CryptoEncoder from "@/components/CryptoEncoder";
import WhoIsTool from "@/components/WhoIsTool";
import DnsLookupTool from "@/components/DnsLookupTool";
import PortScanTool from "@/components/PortScanTool";
import SubdomainTool from "@/components/SubdomainTool";
import HttpHeaderTool from "@/components/HttpHeaderTool";
import TlsCertTool from "@/components/TlsCertTool";
import SEOManager from "@/components/SEOManager";
import OsintServiceStatus from "@/components/OsintServiceStatus";

// ── Tool Mode Definitions ──
const TOOL_MODES = [
  { id: "osint", label: "OSINT", color: "bg-cyan-400" },
  { id: "geoip", label: "IP Geolocation", color: "bg-emerald-400" },
  { id: "crypto", label: "Crypto Codec", color: "bg-amber-400" },
  { id: "whois", label: "WhoIs", color: "bg-violet-400" },
  { id: "dns", label: "DNS Lookup", color: "bg-sky-400" },
  { id: "portscan", label: "Port Scan", color: "bg-rose-400" },
  { id: "subdomain", label: "Subdomains", color: "bg-teal-400" },
  { id: "headers", label: "Headers", color: "bg-orange-400" },
  { id: "tlscert", label: "TLS Cert", color: "bg-violet-400" },
] as const;

type ToolMode = (typeof TOOL_MODES)[number]["id"];

// ── Live Cyber Threats — currently unavailable ──
// Previously contained hardcoded/fabricated threat data that has been removed
// for honesty. When a real threat intel feed API is integrated, results will
// appear here.

// ── Google Dorking Queries ──
const GOOGLE_DORKS = [
  { query: 'site:*.gov filetype:xls "confidential"', description: "Find confidential spreadsheets on government domains" },
  { query: 'intitle:"index of" "backup.sql"', description: "Locate exposed MySQL backup files" },
  { query: 'inurl:"/wp-content/uploads/" filetype:sql', description: "Find WordPress database dumps in uploads" },
  { query: 'site:github.com "api_key" "slack"', description: "Discover committed Slack API tokens" },
  { query: 'inurl:"server-status" "Apache"', description: "Find exposed Apache server-status pages" },
  { query: 'intitle:"phpinfo()" intext:"PHP Version"', description: "Locate exposed phpinfo() pages" },
];

// ── Professional Resources ──
interface ResourceLink {
  name: string;
  url: string;
  description: string;
  category: string;
  icon: string;
}

const RESOURCE_LINKS: ResourceLink[] = [
  {
    name: "OSINT Framework",
    url: "https://osintframework.com/",
    description: "Comprehensive tree of OSINT tools categorized by data type — from DNS to social media",
    category: "OSINT",
    icon: "globe",
  },
  {
    name: "Bellingcat Toolkit",
    url: "https://www.bellingcat.com/resources/how-tos/",
    description: "Open-source investigation playbooks for geolocation, chronolocation, and digital forensics",
    category: "Investigation",
    icon: "search",
  },
  {
    name: "MITRE ATT&CK — Reconnaissance (TA0043)",
    url: "https://attack.mitre.org/tactics/TA0043/",
    description: "Adversary behavioral mapping for Active Scanning, Search Victim-Owned Websites, and DNS/Passive DNS",
    category: "Threat Mapping",
    icon: "target",
  },
  {
    name: "Shodan",
    url: "https://www.shodan.io/",
    description: "Search engine for internet-connected devices — discover exposed services and ICS/SCADA systems",
    category: "Surface Discovery",
    icon: "globe",
  },
  {
    name: "Censys",
    url: "https://search.censys.io/",
    description: "Attack surface mapping via continuous internet-wide TLS and IPv4/IPv6 scans",
    category: "Surface Discovery",
    icon: "globe",
  },
  {
    name: "URLScan.io",
    url: "https://urlscan.io/",
    description: "Free website scanner and screenshot capture for phishing analysis and infrastructure association",
    category: "Investigation",
    icon: "search",
  },
  {
    name: "Have I Been Pwned",
    url: "https://haveibeenpwned.com/",
    description: "Breach database — check email addresses and domains against aggregated credential leaks",
    category: "Breach Intel",
    icon: "shield",
  },
  {
    name: "DeHashed",
    url: "https://dehashed.com/",
    description: "Deep breach search engine — query by email, username, password hash, IP, or name",
    category: "Breach Intel",
    icon: "shield",
  },
  {
    name: "BGP.HE.NET",
    url: "https://bgp.he.net/",
    description: "BGP routing, ASN ownership, and IP prefix lookup — essential for infrastructure mapping",
    category: "Network Intel",
    icon: "globe",
  },
  {
    name: "DNSDumpster",
    url: "https://dnsdumpster.com/",
    description: "DNS recon and domain research tool — visual mapping of DNS records and subdomains",
    category: "DNS",
    icon: "globe",
  },
  {
    name: "SecurityTrails",
    url: "https://securitytrails.com/",
    description: "Historical DNS data, WHOIS history, and subdomain discovery via passive DNS database",
    category: "DNS",
    icon: "globe",
  },
  {
    name: "GreyNoise",
    url: "https://viz.greynoise.io/",
    description: "Filter internet noise — determine if an IP is scanning the internet or behaving maliciously",
    category: "Threat Intel",
    icon: "zap",
  },
];

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  globe: <Globe className="h-4 w-4" />,
  search: <Search className="h-4 w-4" />,
  target: <Target className="h-4 w-4" />,
  shield: <Shield className="h-4 w-4" />,
  zap: <Zap className="h-4 w-4" />,
};

// ── OsintPage Component ──
const OsintPage = () => {
  const { toast } = useToast();
  const [toolMode, setToolMode] = useState<ToolMode>("osint");
  const [dorkCopiedIdx, setDorkCopiedIdx] = useState<number | null>(null);
  const [breachInputType, setBreachInputType] = useState<"email" | "phone" | "domain">("email");
  const [breachInput, setBreachInput] = useState("");
  const [metadataFile, setMetadataFile] = useState<File | null>(null);
  const [expandedThreats, setExpandedThreats] = useState<Set<string>>(new Set());

  // ── OSINT Investigation State (preserved) ──
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [modules, setModules] = useState<string[]>(["whois", "dns", "rdns", "asn", "tls", "geoip", "breach", "social", "news"]);
  const [result, setResult] = useState<any>(null);

  type PyRecommendationResponse = {
    user_id?: string | null;
    generated_at: string;
    recommendations: Array<{ title: string; reason: string; action: string; priority?: number }>;
    signals?: Record<string, unknown>;
  };

  const [pyRecommendations, setPyRecommendations] = useState<PyRecommendationResponse | null>(null);
  const [pyRecLoading, setPyRecLoading] = useState(false);
  const [pyRecError, setPyRecError] = useState("");

  const loadPyRecommendations = useCallback(async () => {
    if (!getStoredAccessToken()) {
      setPyRecommendations(null); setPyRecError(""); return;
    }
    setPyRecLoading(true); setPyRecError("");
    try {
      const payload = await apiGetJson<PyRecommendationResponse>("/api/recommendations");
      setPyRecommendations(payload);
    } catch (error) {
      setPyRecommendations(null);
      setPyRecError(getPyApiUserMessage(error, "Live recommendations are temporarily unavailable."));
    } finally {
      setPyRecLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPyRecommendations().catch(() => undefined);
  }, [loadPyRecommendations]);

  // ── Copy handler ──
  const copyToClipboard = useCallback(async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setDorkCopiedIdx(idx);
      setTimeout(() => setDorkCopiedIdx(null), 2000);
    } catch { /* ignore */ }
  }, []);

  // ── Toggle threat expansion (reserved for live feed) ──
  const toggleThreat = useCallback((id: string) => {
    setExpandedThreats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Collapse state (reserved for live feed) ──
  const collapsedThreats = useMemo(
    () => [] as { id: string }[],
    [],
  );

  // ── Risk score from result ──
  const riskScore = result?.insight?.score ?? null;
  const riskLevel = result?.insight?.level ?? "unknown";

  return (
    <div className="page-shell">
      <SEOManager
        title="OSINT Command Center | ZeroDay Guardian"
        description="Investigate domains, IPs, usernames, and case evidence with a premium OSINT workflow. Live threat feeds, OSINT tools, and professional resources."
        path="/osint"
        keywords="OSINT platform, threat intelligence, whois, dns lookup, cyber investigation, google dorking, metadata extraction"
      />

      {/* ── Header Section ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(34,211,238,0.16),transparent_45%),radial-gradient(circle_at_85%_22%,rgba(251,191,36,0.12),transparent_40%)]" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-8 pt-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.3em] text-slate-200/80">
            OSINT COMMAND CENTER
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">
            World-Class OSINT Platform,{" "}
            <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-amber-200 bg-clip-text text-transparent">
              built into your site.
            </span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-200/80 md:text-base">
            Investigate domains, IPs, emails, and usernames with curated integrations across WHOIS, DNS, breach data,
            geolocation, social signals, and live threat news.
          </p>
        </div>
      </section>

      {/* ── 3-Column Tactical Dashboard ── */}
      <section className="mx-auto max-w-7xl px-4 pb-8">
        <div className="grid gap-4 lg:grid-cols-[280px_1fr_280px]">
          {/* ═══ LEFT COLUMN: Threat Feeds & Intel Streams ═══ */}
          <div className="space-y-3">
            {/* ── Service Status Panel ── */}
            <OsintServiceStatus />

            <div className="flex items-center gap-2 mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">THREAT FEED</span>
            </div>

            {/* Honest empty state — no fake threats */}
            <div className="rounded-lg border border-slate-800/40 bg-slate-900/20 p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/40">
                <AlertTriangle className="h-5 w-5 text-slate-500" />
              </div>
              <p className="font-mono text-xs font-medium text-slate-400">No live threat data available</p>
              <p className="mt-1 font-mono text-[10px] text-slate-600 leading-relaxed">
                A real threat intel feed will appear here once connected to a
                live provider (e.g., CISA, AlienVault OTX, or GreyNoise API).
              </p>
            </div>

            {/* Intel telemetry cards */}
            <div className="space-y-2 mt-4">
              <div className="rounded-lg border border-slate-800/40 bg-slate-900/30 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-1 w-1 rounded-full bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.5)]" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500">SIGNAL</span>
                </div>
                <div className="font-mono text-lg font-bold tracking-wider text-slate-100">{riskScore ?? "--"}</div>
                <div className="font-mono text-[9px] text-slate-500">Level: {riskLevel}</div>
              </div>
              <div className="rounded-lg border border-slate-800/40 bg-slate-900/30 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500">THREAT INTEL</span>
                </div>
                <div className="font-mono text-[10px] text-slate-400 leading-relaxed">
                  {result?.insight?.highlights?.length > 0
                    ? result.insight.highlights[0]
                    : "Run an investigation to generate threat signals."}
                </div>
              </div>
            </div>
          </div>

          {/* ═══ CENTER COLUMN: OSINT Tools & Workflows ═══ */}
          <div className="space-y-4">
            {/* Tool mode selector */}
            <div className="flex flex-wrap items-center gap-1.5">
              {TOOL_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setToolMode(mode.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-[0.12em] transition-all duration-200 ${
                    toolMode === mode.id
                      ? "bg-slate-800/80 text-white ring-1 ring-slate-600"
                      : "text-slate-500 hover:text-slate-300 hover:bg-slate-900/60"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${mode.color}`} />
                  {mode.label}
                </button>
              ))}
            </div>

            {/* ── Tool Content ── */}
            {toolMode === "geoip" ? (
              <IpGeolocationTool />
            ) : toolMode === "crypto" ? (
              <CryptoEncoder />
            ) : toolMode === "whois" ? (
              <WhoIsTool />
            ) : toolMode === "dns" ? (
              <DnsLookupTool />
            ) : toolMode === "portscan" ? (
              <PortScanTool />
            ) : toolMode === "subdomain" ? (
              <SubdomainTool />
            ) : toolMode === "headers" ? (
              <HttpHeaderTool />
            ) : toolMode === "tlscert" ? (
              <TlsCertTool />
            ) : (
              /* ── Main OSINT Investigation Panel ── */
              <div className="space-y-4">
                {/* Investigation input */}
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-wrap gap-3 items-start">
                    <div className="relative flex-1 min-w-[200px]">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-emerald-400">
                        {">_"}
                      </span>
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Enter domain, IP, email, or username"
                        className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 pl-8 pr-3 font-mono text-sm text-slate-100 placeholder-slate-500 transition-all duration-200 focus:border-cyan-500/50 focus:shadow-[0_0_12px_rgba(34,211,238,0.08)] focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!query.trim()) {
                          toast({ title: "Add a target to investigate." });
                          return;
                        }
                        setLoading(true);
                        try {
                          const response = await api.post<Record<string, unknown> & { verified?: boolean }>(
                            "/api/osint/resolve",
                            { query: query.trim(), modules },
                          );
                          setResult(response.data);
                        } catch (error: any) {
                          toast({
                            title: "OSINT request failed",
                            description: getPyApiUserMessage(error, "Try again in a moment."),
                          });
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="h-10 rounded-lg bg-gradient-to-r from-cyan-400 via-sky-400 to-amber-300 px-5 text-xs font-bold text-slate-950 shadow-[0_4px_12px_rgba(56,189,248,0.2)] transition hover:scale-[1.02]"
                    >
                      {loading ? "Running..." : "Run Investigation"}
                    </button>
                  </div>

                  {/* Module toggles */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {["whois", "dns", "rdns", "asn", "tls", "geoip", "breach", "social", "news"].map((mod) => (
                      <button
                        key={mod}
                        type="button"
                        onClick={() =>
                          setModules((prev) =>
                            prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
                          )
                        }
                        className={`rounded-full px-2 py-0.5 text-[9px] font-semibold transition ${
                          modules.includes(mod)
                            ? "bg-cyan-400/20 text-cyan-100 ring-1 ring-cyan-300/40"
                            : "bg-white/5 text-slate-300 ring-1 ring-white/10"
                        }`}
                      >
                        {mod.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── OSINT Workflow Panels ── */}
                <div className="grid gap-4 sm:grid-cols-3">
                  {/* Google Dorking Engine */}
                  <div className="rounded-lg border border-slate-800/50 bg-slate-900/30 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Search className="h-3.5 w-3.5 text-amber-400" />
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-300">
                        Google Dorking Engine
                      </span>
                    </div>
                    <p className="font-mono text-[9px] text-slate-500 mb-2 leading-relaxed">
                      Copy advanced query syntax for targeted intelligence gathering.
                    </p>
                    <div className="space-y-1.5">
                      {GOOGLE_DORKS.map((dork, idx) => (
                        <div
                          key={idx}
                          className="group relative rounded border border-slate-800/40 bg-slate-950/50 px-2 py-1.5 cursor-pointer transition hover:border-cyan-500/30"
                          onClick={() => copyToClipboard(dork.query, idx)}
                        >
                          <p className="font-mono text-[9px] text-cyan-300/90 truncate pr-6">{dork.query}</p>
                          <p className="font-mono text-[7px] text-slate-600 mt-0.5">{dork.description}</p>
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-slate-600 opacity-0 transition-opacity group-hover:opacity-100">
                            {dorkCopiedIdx === idx ? (
                              <Copy className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Metadata Extractor Tracker */}
                  <div className="rounded-lg border border-slate-800/50 bg-slate-900/30 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Upload className="h-3.5 w-3.5 text-violet-400" />
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-300">
                        Metadata Extractor
                      </span>
                    </div>
                    <p className="font-mono text-[9px] text-slate-500 mb-2 leading-relaxed">
                      Drop target document to extract EXIF/XMP telemetry.
                    </p>
                    <div
                      className={`rounded-lg border-2 border-dashed p-4 text-center transition-all duration-200 ${
                        metadataFile
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-slate-700/40 bg-slate-900/40 hover:border-cyan-500/30"
                      }`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          setMetadataFile(file);
                          toast({ title: "File queued for metadata extraction", description: file.name });
                        }
                      }}
                    >
                      {metadataFile ? (
                        <div className="space-y-1">
                          <FileText className="mx-auto h-6 w-6 text-emerald-400" />
                          <p className="font-mono text-[10px] text-emerald-300">{metadataFile.name}</p>
                          <p className="font-mono text-[8px] text-slate-500">
                            {(metadataFile.size / 1024).toFixed(1)} KB
                          </p>
                          <button
                            type="button"
                            onClick={() => setMetadataFile(null)}
                            className="mt-1 rounded-full border border-slate-700/50 px-2 py-0.5 font-mono text-[8px] text-slate-500 hover:text-rose-300 hover:border-rose-400/30"
                          >
                            Clear
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Upload className="mx-auto h-6 w-6 text-slate-600" />
                          <p className="font-mono text-[9px] text-slate-500">
                            Drop Target Document (.pdf, .jpg)
                          </p>
                          <p className="font-mono text-[8px] text-slate-600">
                            EXIF / XMP Telemetry Extraction
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Breach Database Cross-Referencer */}
                  <div className="rounded-lg border border-slate-800/50 bg-slate-900/30 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-3.5 w-3.5 text-rose-400" />
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-300">
                        Breach Cross-Referencer
                      </span>
                    </div>
                    <p className="font-mono text-[9px] text-slate-500 mb-2 leading-relaxed">
                      Query breach databases by identity vector.
                    </p>
                    <div className="space-y-2">
                      <div className="flex gap-1">
                        {(["email", "phone", "domain"] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setBreachInputType(type)}
                            className={`rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] transition ${
                              breachInputType === type
                                ? "bg-rose-500/15 text-rose-200 border border-rose-500/30"
                                : "text-slate-500 border border-slate-700/30 hover:border-slate-600/50"
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <input
                          value={breachInput}
                          onChange={(e) => setBreachInput(e.target.value)}
                          placeholder={
                            breachInputType === "email"
                              ? "target@domain.com"
                              : breachInputType === "phone"
                              ? "+1-555-000-0000"
                              : "domain.com"
                          }
                          className="flex-1 rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5 font-mono text-[10px] text-slate-200 placeholder-slate-600 outline-none focus:border-cyan-500/40"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!breachInput.trim()) {
                              toast({ title: "Enter a target to cross-reference." });
                              return;
                            }
                            toast({ title: "Breach query queued", description: `${breachInputType}: ${breachInput}` });
                          }}
                          className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 font-mono text-[9px] text-cyan-300 transition hover:bg-cyan-500/20"
                        >
                          Query
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommendations strip */}
                {pyRecommendations?.recommendations?.length > 0 && (
                  <div className="rounded-lg border border-slate-800/50 bg-slate-900/30 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-3.5 w-3.5 text-amber-400" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-300">
                        Live Recommendations
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {pyRecommendations.recommendations.slice(0, 3).map((rec, idx) => (
                        <div key={idx} className="flex items-start gap-2 rounded bg-slate-950/40 px-2 py-1.5">
                          <span className="mt-0.5 font-mono text-[9px] text-cyan-400/70">{">"}</span>
                          <div>
                            <p className="font-mono text-[10px] text-slate-200">{rec.title}</p>
                            <p className="font-mono text-[8px] text-slate-500">{rec.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Investigation Results */}
                {result && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <TerminalSquare className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-300">
                        Investigation Results
                      </span>
                    </div>
                    <pre className="max-h-64 overflow-auto font-mono text-[10px] text-slate-300/80 leading-relaxed">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ═══ RIGHT COLUMN: Practical Resources & OSINT Hub ═══ */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-3.5 w-3.5 text-sky-400" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">OSINT RESOURCE HUB</span>
            </div>

            {/* Resources by category */}
            {["OSINT", "Investigation", "Surface Discovery", "Threat Intel", "Breach Intel", "DNS", "Network Intel", "Threat Mapping"].map((category) => {
              const catResources = RESOURCE_LINKS.filter((r) => r.category === category);
              if (catResources.length === 0) return null;
              return (
                <div key={category} className="rounded-lg border border-slate-800/40 bg-slate-900/30 p-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500 mb-2">
                    {category}
                  </p>
                  <div className="space-y-1.5">
                    {catResources.map((resource) => (
                      <a
                        key={resource.name}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-2 rounded px-2 py-1.5 transition hover:bg-slate-800/40"
                      >
                        <span className="mt-0.5 text-slate-500 group-hover:text-cyan-400 transition-colors">
                          {RESOURCE_ICONS[resource.icon] || <Globe className="h-3.5 w-3.5" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[10px] font-semibold text-slate-200 truncate group-hover:text-cyan-200 transition-colors">
                            {resource.name}
                          </p>
                          <p className="font-mono text-[8px] text-slate-500 leading-relaxed mt-0.5">
                            {resource.description}
                          </p>
                        </div>
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100" />
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Quick reference — OSINT Playbooks */}
            <div className="rounded-lg border border-slate-800/40 bg-slate-900/30 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-3 w-3 text-emerald-400" />
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500">
                  OSINT Playbooks
                </span>
              </div>
              <div className="space-y-1.5">
                {[
                  {
                    title: "Breach Impact Triage",
                    desc: "Assess leaked identities and validate asset ownership.",
                    modules: ["breach", "whois", "dns"],
                  },
                  {
                    title: "Infrastructure Recon",
                    desc: "Map network exposure and certificate history.",
                    modules: ["dns", "rdns", "asn", "tls"],
                  },
                  {
                    title: "Brand Impersonation Sweep",
                    desc: "Check for spoof domains and reputation signals.",
                    modules: ["whois", "tls", "news"],
                  },
                ].map((playbook) => (
                  <div key={playbook.title} className="rounded bg-slate-950/40 px-2 py-1.5">
                    <p className="font-mono text-[9px] font-semibold text-slate-200">{playbook.title}</p>
                    <p className="font-mono text-[8px] text-slate-500">{playbook.desc}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {playbook.modules.map((mod) => (
                        <span
                          key={mod}
                          className="rounded-full bg-slate-800/40 px-1.5 py-0.5 font-mono text-[7px] text-slate-500"
                        >
                          {mod.toUpperCase()}
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setModules(playbook.modules);
                          toast({ title: `Loaded ${playbook.title} playbook` });
                        }}
                        className="ml-auto rounded-full border border-slate-700/30 px-1.5 py-0.5 font-mono text-[7px] text-slate-400 hover:border-cyan-500/30 hover:text-cyan-300"
                      >
                        Load
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Compliance notice */}
            <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2">
              <div className="flex items-start gap-1.5">
                <Info className="mt-0.5 h-3 w-3 text-amber-400/70 shrink-0" />
                <p className="font-mono text-[8px] leading-relaxed text-amber-300/70">
                  Use only on assets you own or are authorized to test. We log requests and enforce safe OSINT usage policies.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OsintPage;
