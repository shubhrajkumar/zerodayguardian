import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="relative z-10 border-t border-white/6 bg-[#090d14]/78 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-10">
        <div className="cyber-card grid grid-cols-1 gap-8 rounded-[28px] p-6 sm:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h3 className="glow-text text-lg font-black tracking-[-0.03em] text-white">ZeroDay-Guardian</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
              Guided cybersecurity training with validated labs, adaptive guidance, and a clear next step on every screen.
            </p>
          </div>
          <div>
            <h4 className="terminal-font text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Quick Links</h4>
            <div className="mt-3 flex flex-col gap-2">
              {[
                { label: "Home", to: "/" },
                { label: "Program", to: "/program" },
                { label: "Dashboard", to: "/dashboard" },
              ].map((link) => (
                <Link key={link.to} to={link.to} className="text-sm text-slate-400 transition-colors hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-white/6 pt-4 text-center">
          <p className="terminal-font text-xs text-slate-500">© {new Date().getFullYear()} ZeroDay-Guardian. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
