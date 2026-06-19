import { useState } from "react";
import { Loader2, Search, Terminal, Copy, Check, Shield, ShieldAlert, ShieldCheck, ChevronRight } from "lucide-react";

type SubjectAltNames = {
  dns: string[];
  ips: string[];
  emails: string[];
  raw: string[];
};

type CertEntry = {
  subject: Record<string, string>;
  issuer: Record<string, string>;
  validity: { from: string | null; to: string | null };
  serialNumber: string | null;
  fingerprint: string | null;
  subjectAltName: string | null;
};

type TlsCertResponse = {
  status: string;
  host: string;
  port: number;
  authorized: boolean;
  authorizationError: string | null;
  protocol: string | null;
  leaf: {
    subject: Record<string, string>;
    issuer: Record<string, string>;
    validity: { from: string | null; to: string | null };
    serialNumber: string | null;
    fingerprint: string | null;
    fingerprint256: string | null;
    subjectAltNames: SubjectAltNames;
    keyAlgorithm: string | null;
    signatureAlgorithm: string | null;
    keyUsage: string[];
    modulusBits: number | null;
    expired: boolean;
    daysRemaining: number | null;
  };
  chain: CertEntry[];
  chainLength: number;
};

const API_PATH = "/api/tools/tlscert";

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
};

const getExpiryStatus = (
  expired: boolean,
  daysRemaining: number | null
): { label: string; color: string; icon: React.ReactNode } => {
  if (expired) {
    return {
      label: "EXPIRED",
      color: "text-rose-400",
      icon: <ShieldAlert className="h-4 w-4" />,
    };
  }
  if (daysRemaining === null) {
    return {
      label: "UNKNOWN",
      color: "text-slate-400",
      icon: <Shield className="h-4 w-4" />,
    };
  }
  if (daysRemaining <= 14) {
    return {
      label: `${daysRemaining}d REMAINING`,
      color: "text-amber-400",
      icon: <ShieldAlert className="h-4 w-4" />,
    };
  }
  if (daysRemaining <= 60) {
    return {
      label: `${daysRemaining}d REMAINING`,
      color: "text-emerald-400",
      icon: <ShieldCheck className="h-4 w-4" />,
    };
  }
  return {
    label: `${daysRemaining}d REMAINING`,
    color: "text-emerald-400",
    icon: <ShieldCheck className="h-4 w-4" />,
  };
};

const formatSubject = (subject: Record<string, string>) => {
  if (!subject || Object.keys(subject).length === 0) return "—";
  return Object.entries(subject)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
};

export default function TlsCertTool() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("443");
  const [loading, setLoading] = useState(false);
  const [certData, setCertData] = useState<TlsCertResponse | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const lookup = async () => {
    let target = host.trim().toLowerCase();
    if (!target) return;

    target = target
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/\s/g, "");

    const targetPort = port.trim() || "443";

    setLoading(true);
    setError("");
    setCertData(null);

    try {
      const res = await fetch(
        `${API_PATH}?host=${encodeURIComponent(target)}&port=${encodeURIComponent(targetPort)}`
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

      const data: TlsCertResponse = await res.json();
      setCertData(data);
    } catch {
      setError("[!] ERROR: Uplink rejected target structure.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) lookup();
  };

  const copyResults = () => {
    if (!certData) return;
    const lines = [
      `Host: ${certData.host}:${certData.port}`,
      `Authorized: ${certData.authorized}`,
      ``,
      `── Subject ──`,
      `${formatSubject(certData.leaf.subject)}`,
      ``,
      `── Issuer ──`,
      `${formatSubject(certData.leaf.issuer)}`,
      ``,
      `── Validity ──`,
      `From: ${certData.leaf.validity.from || "—"}`,
      `To: ${certData.leaf.validity.to || "—"}`,
      `Expired: ${certData.leaf.expired}`,
      `Days Remaining: ${certData.leaf.daysRemaining ?? "—"}`,
      ``,
      `── Fingerprints ──`,
      `SHA-1: ${certData.leaf.fingerprint || "—"}`,
      `SHA-256: ${certData.leaf.fingerprint256 || "—"}`,
      ``,
      `── Subject Alt Names ──`,
      `DNS: ${certData.leaf.subjectAltNames.dns.join(", ") || "—"}`,
      `IPs: ${certData.leaf.subjectAltNames.ips.join(", ") || "—"}`,
      ``,
      `── Key Info ──`,
      `Algorithm: ${certData.leaf.keyAlgorithm || "—"}`,
      `Signature: ${certData.leaf.signatureAlgorithm || "—"}`,
      `Key Usage: ${certData.leaf.keyUsage.join(", ") || "—"}`,
      `Modulus Bits: ${certData.leaf.modulusBits ?? "—"}`,
      ``,
      `── Chain ──`,
      ...certData.chain.map(
        (c, i) =>
          `  ${i + 1}. ${c.subject.CN || formatSubject(c.subject)} [${c.fingerprint?.slice(0, 20) || "—"}...]`
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const expiryStatus = certData
    ? getExpiryStatus(certData.leaf.expired, certData.leaf.daysRemaining)
    : null;

  return (
    <div className="terminal-card overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.5)]" />
          <div>
            <h2 className="text-sm font-bold text-slate-100">TLS CERTIFICATE ANALYZER</h2>
            <p className="font-mono text-[10px] text-slate-500 mt-0.5">
              // Fetch and inspect SSL/TLS certificate details
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-violet-400/70">
            [TARGET]
          </span>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ENTER HOST (e.g., example.com)"
            className="h-12 w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-16 pr-4 font-mono text-sm text-slate-100 placeholder-slate-600 transition-all duration-200 focus:border-violet-500/50 focus:shadow-[0_0_12px_rgba(167,139,250,0.08)] focus:outline-none"
          />
        </div>
        <div className="relative w-24 shrink-0">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-violet-400/50">
            :PORT
          </span>
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="443"
            className="h-12 w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-10 pr-3 font-mono text-sm text-slate-100 placeholder-slate-600 transition-all duration-200 focus:border-violet-500/50 focus:outline-none"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={lookup}
        disabled={loading || !host.trim()}
        className="h-10 w-full rounded-lg bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-300 px-4 text-xs font-bold text-slate-950 shadow-[0_8px_24px_rgba(167,139,250,0.2)] transition hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            FETCHING CERTIFICATE...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Search className="h-4 w-4" />
            ANALYZE CERTIFICATE
          </span>
        )}
      </button>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3">
          <p className="font-mono text-xs text-rose-300/90">{error}</p>
        </div>
      ) : null}

      {certData ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-violet-500/20 bg-slate-950/80 p-4">
            {/* Terminal header */}
            <div className="mb-3 flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-violet-400" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-violet-400/80">
                src/certs/{certData.host}.json
              </span>
            </div>

            {/* Summary bar */}
            <div className="mb-3 flex flex-wrap gap-3 text-[10px] font-mono">
              <span className="text-slate-500">
                Host: <span className="text-slate-300">{certData.host}:{certData.port}</span>
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-500">
                Chain: <span className="text-slate-300">{certData.chainLength} certs</span>
              </span>
              <span className="text-slate-500">•</span>
              <span
                className={
                  certData.authorized ? "text-emerald-400" : "text-rose-400"
                }
              >
                {certData.authorized ? "TRUSTED" : "UNTRUSTED"}
              </span>
            </div>

            {/* Expiry status banner */}
            {expiryStatus && (
              <div
                className={`mb-4 flex items-center gap-3 rounded-lg border p-3 ${
                  certData.leaf.expired
                    ? "bg-rose-500/10 border-rose-500/20"
                    : certData.leaf.daysRemaining !== null && certData.leaf.daysRemaining <= 14
                    ? "bg-amber-500/10 border-amber-500/20"
                    : "bg-emerald-500/10 border-emerald-500/20"
                }`}
              >
                {expiryStatus.icon}
                <div className="flex-1">
                  <span className={`text-xs font-semibold font-mono ${expiryStatus.color}`}>
                    {expiryStatus.label}
                  </span>
                  <span className="text-[10px] text-slate-500 ml-2">
                    {formatDate(certData.leaf.validity.to)}
                  </span>
                </div>
              </div>
            )}

            {/* ── Certificate Details ── */}
            <div className="space-y-3">
              {/* Subject */}
              <div className="rounded-lg border border-slate-800/40 bg-slate-900/30 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    SUBJECT
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-300 break-all">
                  {formatSubject(certData.leaf.subject)}
                </div>
              </div>

              {/* Issuer */}
              <div className="rounded-lg border border-slate-800/40 bg-slate-900/30 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    ISSUER
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-300 break-all">
                  {formatSubject(certData.leaf.issuer)}
                </div>
              </div>

              {/* Validity */}
              <div className="rounded-lg border border-slate-800/40 bg-slate-900/30 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    VALIDITY PERIOD
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div>
                    <span className="text-slate-500">Not Before</span>
                    <p className="text-slate-300">{formatDate(certData.leaf.validity.from)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Not After</span>
                    <p className="text-slate-300">{formatDate(certData.leaf.validity.to)}</p>
                  </div>
                </div>
              </div>

              {/* Subject Alternative Names */}
              {certData.leaf.subjectAltNames.dns.length > 0 && (
                <div className="rounded-lg border border-slate-800/40 bg-slate-900/30 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      SUBJECT ALT NAMES (SANs)
                    </span>
                    <span className="text-[10px] font-mono text-slate-600">
                      ({certData.leaf.subjectAltNames.dns.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {certData.leaf.subjectAltNames.dns.map((san) => (
                      <span
                        key={san}
                        className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-300/80"
                      >
                        {san}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Fingerprints */}
              <div className="rounded-lg border border-slate-800/40 bg-slate-900/30 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    FINGERPRINTS
                  </span>
                </div>
                <div className="space-y-1.5">
                  {certData.leaf.fingerprint && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-slate-500 w-16 shrink-0">SHA-1</span>
                      <span className="font-mono text-[10px] text-slate-300 break-all font-mono">
                        {certData.leaf.fingerprint}
                      </span>
                    </div>
                  )}
                  {certData.leaf.fingerprint256 && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-slate-500 w-16 shrink-0">SHA-256</span>
                      <span className="font-mono text-[10px] text-slate-300 break-all font-mono">
                        {certData.leaf.fingerprint256}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Key Info */}
              <div className="rounded-lg border border-slate-800/40 bg-slate-900/30 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    KEY INFO
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div>
                    <span className="text-slate-500">Public Key Algo</span>
                    <p className="text-slate-300">{certData.leaf.keyAlgorithm || "—"}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Signature Algo</span>
                    <p className="text-slate-300">{certData.leaf.signatureAlgorithm || "—"}</p>
                  </div>
                  {certData.leaf.modulusBits && (
                    <div>
                      <span className="text-slate-500">Key Size</span>
                      <p className="text-slate-300">{certData.leaf.modulusBits} bits</p>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500">Serial #</span>
                    <p className="text-slate-300 font-mono text-[9px] break-all">
                      {certData.leaf.serialNumber || "—"}
                    </p>
                  </div>
                </div>
                {certData.leaf.keyUsage.length > 0 && (
                  <div className="mt-2">
                    <span className="font-mono text-[9px] text-slate-500">Key Usage</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {certData.leaf.keyUsage.map((ku) => (
                        <span
                          key={ku}
                          className="rounded-full bg-slate-800/40 px-1.5 py-0.5 font-mono text-[9px] text-slate-400"
                        >
                          {ku}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Certificate Chain */}
              {certData.chain.length > 1 && (
                <div className="rounded-lg border border-slate-800/40 bg-slate-900/30 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      CERTIFICATE CHAIN
                    </span>
                    <span className="text-[10px] font-mono text-slate-600">
                      ({certData.chainLength} certs)
                    </span>
                  </div>
                  <div className="space-y-2">
                    {certData.chain.map((cert, i) => (
                      <div key={i}>
                        <div className="flex items-center gap-2 text-[10px] font-mono">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold ${
                              i === 0
                                ? "bg-violet-500/20 text-violet-300"
                                : "bg-slate-800/50 text-slate-500"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-300 truncate">
                              {cert.subject.CN || cert.subject.O || formatSubject(cert.subject)}
                            </p>
                            <p className="text-slate-500 text-[9px] truncate">
                              Issuer: {cert.issuer.CN || cert.issuer.O || formatSubject(cert.issuer)}
                            </p>
                          </div>
                          {cert.fingerprint && (
                            <span className="text-[8px] text-slate-600 font-mono shrink-0">
                              {cert.fingerprint.slice(0, 16)}...
                            </span>
                          )}
                        </div>
                        {i < certData.chain.length - 1 && (
                          <div className="ml-2.5 mt-1 mb-1">
                            <ChevronRight className="h-3 w-3 text-slate-600 rotate-90" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Copy + Raw toggle */}
            <div className="mt-3 flex items-center justify-between border-t border-violet-500/10 pt-3">
              <button
                type="button"
                onClick={() => setShowRaw(!showRaw)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-mono text-slate-400 transition hover:border-violet-300/30 hover:text-violet-300"
              >
                {showRaw ? "Hide Raw" : "Show Raw"}
              </button>
              <button
                type="button"
                onClick={copyResults}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-mono text-slate-400 transition hover:border-violet-300/30 hover:text-violet-300"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    COPIED
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    COPY REPORT
                  </>
                )}
              </button>
            </div>

            {/* Raw JSON display */}
            {showRaw && (
              <div className="mt-3 rounded-lg border border-slate-800/40 bg-slate-950/60 p-3">
                <pre className="max-h-64 overflow-auto font-mono text-[10px] text-slate-400 leading-relaxed">
                  {JSON.stringify(certData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {!certData && !error ? (
        <p className="mt-3 font-mono text-[10px] text-slate-600">
          {">"} Enter a host and port to fetch and analyze its TLS certificate.
        </p>
      ) : null}
    </div>
  );
}
