/**
 * ComingSoonLabs — Placeholder component for "Coming Soon: Interactive OSINT & SQLi Labs"
 *
 * Cyber Rationale: This component eliminates Thin Content SEO penalties by providing
 * keyword-rich, engaging placeholder copy that builds hype while maintaining indexability.
 * Contains 150+ words of cybersecurity-themed content targeting Reconnaissance, Payload,
 * Parameterized Queries, SQL Injection, OSINT, and related technical keywords.
 */
import { Shield, Eye, Database, Terminal, Lock, Zap } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";

const features = [
  {
    icon: Eye,
    title: "Live OSINT Reconnaissance",
    description:
      "Master Reconnaissance techniques with hands-on domain enumeration, DNS footprinting, and metadata extraction in sandboxed environments.",
  },
  {
    icon: Database,
    title: "SQL Injection Labs",
    description:
      "Craft and test SQL Injection Payloads against intentionally vulnerable targets. Learn to write Parameterized Queries that neutralize injection vectors at the database layer.",
  },
  {
    icon: Terminal,
    title: "Interactive Payload Workshop",
    description:
      "Build, encode, and deploy custom Payloads across multiple attack surfaces — from XSS to SSRF — with real-time feedback and guided exploit chains.",
  },
  {
    icon: Lock,
    title: "Parameterized Query Defense",
    description:
      "Understand why Parameterized Queries are the gold standard for input sanitization. Practice converting raw SQL to prepared statements across PostgreSQL, MySQL, and SQLite.",
  },
];

const ComingSoonLabs = () => {
  return (
    <div className="page-container py-16">
      {/* Hero */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--theme-accent-blue)_30%,transparent)] bg-[color-mix(in_srgb,var(--theme-accent-blue)_8%,transparent)] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[var(--theme-accent-blue)]">
          <Zap className="h-3 w-3" />
          Coming Soon
        </div>

        <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          <span className="cyber-gradient-text">Interactive OSINT</span> &amp;{" "}
          <span className="cyber-gradient-text">SQLi Labs</span>
        </h1>

        <p className="mb-8 text-base leading-relaxed text-[var(--theme-text-muted)] sm:text-lg">
          ZeroDay Guardian is deploying a new generation of browser-native
          cybersecurity laboratories. These interactive modules will let you
          execute Reconnaissance campaigns, craft SQL Injection Payloads, and
          validate Parameterized Queries against live sandboxed targets — all
          without leaving your browser or risking production infrastructure.
        </p>
      </div>

      {/* Feature Grid */}
      <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, description }) => (
          <GlassCard
            key={title}
            className="group p-6 transition-all duration-300 hover:border-[var(--theme-accent-blue)] hover:shadow-[0_0_24px_var(--theme-glow)]"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--theme-accent-blue)_12%,transparent)]">
              <Icon className="h-5 w-5 text-[var(--theme-accent-blue)]" />
            </div>
            <h3 className="mb-2 text-sm font-semibold text-[var(--theme-text)]">
              {title}
            </h3>
            <p className="text-sm leading-relaxed text-[var(--theme-text-muted)]">
              {description}
            </p>
          </GlassCard>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-12 text-center">
        <GlassCard className="mx-auto inline-flex items-center gap-3 rounded-xl px-6 py-4">
          <Shield className="h-5 w-5 text-[var(--theme-accent-green)]" />
          <div className="text-left">
            <p className="text-sm font-medium text-[var(--theme-text)]">
              Get notified when labs go live
            </p>
            <p className="text-xs text-[var(--theme-text-muted)]">
              Join the ZeroDay Guardian community for early access and beta
              invites.
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default ComingSoonLabs;
