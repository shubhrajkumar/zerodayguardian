import { Link } from "react-router-dom";
import { Swords, Shield, Terminal, Radar } from "lucide-react";

const CONTACT_EMAIL = "ops@zerodayguardian.net";

const footerColumns = [
  {
    title: "OPERATIONS",
    links: [
      { label: "Command Center", to: "/dashboard" },
      { label: "Briefings", to: "/learn" },
      { label: "Combat Labs", to: "/lab" },
      { label: "Program", to: "/program" },
    ],
  },
  {
    title: "INTEL",
    links: [
      { label: "Operations Suite", to: "/tools" },
      { label: "OSINT", to: "/osint" },
      { label: "Intel Feed", to: "/blog" },
      { label: "Network", to: "/community" },
    ],
  },
  {
    title: "TRUST",
    links: [
      { label: "About", to: "/about" },
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
      { label: "Contact", to: "/contact" },
    ],
  },
];

const Footer = () => {
  return (
    <footer className="relative z-10 border-t border-slate-800/40 bg-[#050508]/80 backdrop-blur-xl">
      {/* Scan line decoration */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.02]">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
      </div>
      
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 rounded-xl border border-slate-800/40 bg-slate-900/20 p-6 md:grid-cols-[1.15fr_1fr] md:p-8 hologram-card">
          {/* Left column — brand + description */}
          <div className="space-y-5">
            <div>
              <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]" />
                </span>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                  ZDG:TRUST LAYER // ACTIVE
                </span>
              </div>
              <h3 className="mt-5 text-xl font-black tracking-[-0.03em] text-slate-100">
                Deploy With Confidence
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                Premium cyber operations academy. Real missions, AI mentorship, live labs, and rank progression.
                From Recruit to Elite Guardian — every operator's path is secured.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-800/40 bg-slate-800/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Support Uplink</p>
                </div>
                <a
                  className="group inline-flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/8 px-3 py-1.5 font-mono text-xs text-emerald-300/90 transition-all duration-200 hover:border-emerald-400/50 hover:bg-emerald-500/15 hover:text-emerald-200 hover:shadow-[0_0_12px_rgba(52,211,153,0.2)]"
                  href={`mailto:${CONTACT_EMAIL}`}
                >
                  <span className="text-[10px] uppercase tracking-[0.15em]">[secure-drop]</span>
                  <span className="text-emerald-400/50 mx-0.5">→</span>
                  <span className="opacity-70 group-hover:opacity-100 transition-opacity">{CONTACT_EMAIL}</span>
                </a>
              </div>
              <div className="rounded-lg border border-slate-800/40 bg-slate-800/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Security</p>
                </div>
                <a
                  className="group inline-flex items-center gap-2 rounded-md border border-cyan-500/20 bg-cyan-500/8 px-3 py-1.5 font-mono text-xs text-cyan-300/90 transition-all duration-200 hover:border-cyan-400/50 hover:bg-cyan-500/15 hover:text-cyan-200 hover:shadow-[0_0_12px_rgba(34,211,238,0.2)]"
                  href={`mailto:${CONTACT_EMAIL}`}
                >
                  <span className="text-[10px] uppercase tracking-[0.15em]">[uplink-active]</span>
                  <span className="text-cyan-400/50 mx-0.5">→</span>
                  <span className="opacity-70 group-hover:opacity-100 transition-opacity">{CONTACT_EMAIL}</span>
                </a>
              </div>
            </div>
          </div>

          {/* Right column — nav links */}
          <div className="grid gap-6 sm:grid-cols-3">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-emerald-400/80">
                  [{column.title}]
                </h4>
                <div className="mt-3 flex flex-col gap-2">
                  {column.links.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="text-sm text-slate-500 hover:text-cyan-300 transition-colors font-mono"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-between border-t border-slate-800/30">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-emerald-400" />
            <p className="font-mono text-xs text-slate-500">
              © {new Date().getFullYear()} ZeroDay Guardian Operations
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-600">
            <span className="flex items-center gap-1">
              <Radar className="h-3 w-3" />
              v3.2.1
            </span>
            <span>//</span>
            <span>Deploy. Defend. Breach Complete.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
