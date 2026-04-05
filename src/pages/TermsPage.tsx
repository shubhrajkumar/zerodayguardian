import { Link } from "react-router-dom";

const termsItems = [
  "Use the platform lawfully and only for defensive learning, research, and authorized practice.",
  "Do not use labs, OSINT workflows, or automation features for harassment, unauthorized intrusion, or fraud.",
  "You are responsible for any public content, shared portfolio data, and exported materials you publish.",
  "Platform features may evolve as we improve security, reliability, and compliance.",
];

const TermsPage = () => {
  return (
    <div className="page-shell">
      <section className="container mx-auto px-4 py-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="cyber-card rounded-[28px] p-6 md:p-8">
            <p className="shell-command-chip">Trust Layer / Terms</p>
            <h1 className="mt-4 glow-text">Operational Terms</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              ZeroDay Guardian is built for legitimate cyber education and skill deployment. These terms define the safe
              and authorized use of the platform.
            </p>
          </div>

          <div className="cyber-card rounded-[24px] p-5 md:p-6">
            <h2 className="text-white">Core Rules</h2>
            <div className="mt-4 space-y-3">
              {termsItems.map((item) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-base leading-7 text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="cyber-card rounded-[24px] p-5 md:p-6">
            <h2 className="text-white">Account And Service Limits</h2>
            <p className="mt-3 text-base leading-7 text-slate-300">
              Abuse, credential sharing, scraping, or attempts to bypass platform security controls can result in rate
              limiting, suspension, or permanent removal. Service availability may vary during maintenance or security events.
            </p>
            <div className="mt-5">
              <Link to="/contact" className="cyber-btn cta-focus-ring">
                Contact Command
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TermsPage;
