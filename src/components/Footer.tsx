import { Link } from "react-router-dom";

const CONTACT_EMAIL = "ksubhraj28@gmail.com";

const footerColumns = [
  {
    title: "Platform",
    links: [
      { label: "Dashboard", to: "/dashboard" },
      { label: "Learn", to: "/learn" },
      { label: "Labs", to: "/lab" },
      { label: "Program", to: "/program" },
    ],
  },
  {
    title: "Intel",
    links: [
      { label: "Tools", to: "/tools" },
      { label: "OSINT", to: "/osint" },
      { label: "Blog", to: "/blog" },
      { label: "Community", to: "/community" },
    ],
  },
  {
    title: "Trust",
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
    <footer className="relative z-10 border-t backdrop-blur-xl" style={{ borderColor: "var(--theme-border)", backgroundColor: "color-mix(in srgb, var(--theme-bg) 78%, transparent)" }}>
      <div className="container mx-auto px-4 py-10">
        <div className="grid gap-8 rounded-[28px] p-6 md:grid-cols-[1.15fr_1fr] md:p-8" style={{ background: "var(--theme-card)", border: "1px solid var(--theme-border)" }}>
          <div className="space-y-4">
            <div>
              <p className="shell-command-chip">ZeroDay Guardian / Trust Layer</p>
              <h3 className="mt-4 glow-text text-xl font-black tracking-[-0.03em]" style={{ color: "var(--theme-text)" }}>Deploy With Confidence</h3>
              <p className="mt-3 max-w-xl text-base leading-7" style={{ color: "var(--theme-text-muted)" }}>
                Premium cyber-AI SaaS for guided labs, adaptive missions, OSINT workflows, and resilient progress systems.
                No fake learning loops. No clutter. Just real operator momentum.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl p-4" style={{ border: "1px solid var(--theme-border)", backgroundColor: "var(--theme-overlay)" }}>
                <p className="terminal-font text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--theme-text-dim)" }}>Support</p><a className="mt-2 block break-all text-sm transition-colors hover:opacity-80" href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--theme-text-muted)" }}>
    {CONTACT_EMAIL}
  </a>
              </div>
              <div className="rounded-2xl p-4" style={{ border: "1px solid var(--theme-border)", backgroundColor: "var(--theme-overlay)" }}>
                <p className="terminal-font text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--theme-text-dim)" }}>Security</p><a className="mt-2 block break-all text-sm transition-colors hover:opacity-80" href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--theme-text-muted)" }}>
    {CONTACT_EMAIL}
  </a>
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h4 className="terminal-font text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--theme-text-dim)" }}>{column.title}</h4>
                <div className="mt-3 flex flex-col gap-2">
                  {column.links.map((link) => (
                    <Link key={link.to} to={link.to} className="text-sm transition-colors hover:opacity-80" style={{ color: "var(--theme-text-muted)" }}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 pt-4 text-center" style={{ borderTop: "1px solid var(--theme-border)" }}>
          <p className="terminal-font text-xs" style={{ color: "var(--theme-text-dim)" }}>
            (c) {new Date().getFullYear()} ZeroDay Guardian. Deploy. Defend. Breach Complete.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
