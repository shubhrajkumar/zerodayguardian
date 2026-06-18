const CONTACT_EMAIL = "ops@zerodayguardian.net";

const contactChannels = [
  {
    title: "Support Email",
    detail: CONTACT_EMAIL,
    note: "Use this for billing, account recovery, privacy, and general platform issues.",
  },
  {
    title: "Security Reports",
    detail: CONTACT_EMAIL,
    note: "Use this for vulnerability disclosure, abuse reports, and high-severity trust concerns.",
  },
  {
    title: "Response Window",
    detail: "Mon-Sat / 9AM-7PM IST",
    note: "Critical security reports are triaged faster than general support requests.",
  },
];

const ContactPage = () => {
  return (
    <div className="page-shell">
      <section className="container mx-auto px-4 py-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="cyber-card rounded-[28px] p-6 md:p-8">
            <p className="shell-command-chip">Trust Layer / Contact</p>
            <h1 className="mt-4 glow-text">Support Command Center</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              Need help deploying your workspace, recovering access, reporting a bug, or escalating a security concern?
              Use the live support channels below.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {contactChannels.map((channel) => (
              <article key={channel.title} className="cyber-card rounded-[24px] p-5 md:p-6">
                <h2 className="terminal-font text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--theme-text-dim)' }}>{channel.title}</h2>
                <p className="mt-3 break-all text-lg font-semibold" style={{ color: 'var(--theme-text)' }}>{channel?.detail ?? ''}</p>
                <p className="mt-3 text-base leading-7" style={{ color: 'var(--theme-text-muted)' }}>{channel.note}</p>
              </article>
            ))}
          </div>

          <div className="cyber-card rounded-[24px] p-5 md:p-6">
            <h2 className="text-[var(--theme-text)]">Best Way To Reach Us</h2>
            <p className="mt-3 text-base leading-7 text-[var(--theme-text-muted)]">
              Include your account email, affected page, exact error, and screenshots if available. That helps us breach
              the issue faster and avoid back-and-forth delays.
            </p>
            <div className="mt-5">
              <a href={`mailto:${CONTACT_EMAIL}`} className="cyber-btn cta-focus-ring">
                Deploy Support Email
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;
