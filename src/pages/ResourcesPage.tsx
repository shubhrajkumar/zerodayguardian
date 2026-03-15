import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpenCheck,
  Bot,
  BrainCircuit,
  ShieldCheck,
  Sparkles,
  Swords,
} from "lucide-react";
import { Link } from "react-router-dom";

type CategoryId = "ethical-hacking-tools" | "ai-security-research" | "learning-paths" | "premium-guides";

type ResourceEntry = {
  title: string;
  description: string;
  href: string;
  source: string;
  level: "Foundational" | "Operator" | "Advanced";
  tag: string;
};

type ResourceCategory = {
  id: CategoryId;
  label: string;
  subtitle: string;
  icon: typeof Swords;
  accent: string;
  entries: ResourceEntry[];
};

const categories: ResourceCategory[] = [
  {
    id: "ethical-hacking-tools",
    label: "Ethical Hacking Tools",
    subtitle: "Operator-grade references for recon, web testing, ATT&CK mapping, and defensive validation.",
    icon: Swords,
    accent: "from-cyan-400/30 via-sky-400/10 to-transparent",
    entries: [
      {
        title: "OWASP Web Security Testing Guide",
        description: "Structured methodology for professional web application assessment and validation.",
        href: "https://owasp.org/www-project-web-security-testing-guide/",
        source: "OWASP",
        level: "Operator",
        tag: "Web Testing",
      },
      {
        title: "MITRE ATT&CK Enterprise Matrix",
        description: "Map attacker behavior to detection, hunting, validation, and control coverage.",
        href: "https://attack.mitre.org/matrices/enterprise/",
        source: "MITRE",
        level: "Operator",
        tag: "Threat Mapping",
      },
      {
        title: "CISA Cybersecurity Advisories",
        description: "High-value live advisories for exploitation trends, vulnerabilities, and immediate defensive action.",
        href: "https://www.cisa.gov/news-events/cybersecurity-advisories",
        source: "CISA",
        level: "Advanced",
        tag: "Advisories",
      },
    ],
  },
  {
    id: "ai-security-research",
    label: "AI Security Research",
    subtitle: "Primary-source material for prompt injection, model safety, evaluation, and secure AI deployment.",
    icon: BrainCircuit,
    accent: "from-emerald-400/30 via-cyan-300/10 to-transparent",
    entries: [
      {
        title: "NIST AI Risk Management Framework",
        description: "The baseline framework for governing trustworthy, resilient, and secure AI systems.",
        href: "https://www.nist.gov/itl/ai-risk-management-framework",
        source: "NIST",
        level: "Foundational",
        tag: "Governance",
      },
      {
        title: "Google Secure AI Framework",
        description: "Security-focused guidance for building and deploying AI systems with defense in depth.",
        href: "https://saif.google/",
        source: "Google",
        level: "Advanced",
        tag: "Secure AI",
      },
      {
        title: "OpenAI Prompt Engineering Guide",
        description: "Practical reference for producing reliable prompts, better tool behavior, and safer workflows.",
        href: "https://platform.openai.com/docs/guides/prompt-engineering",
        source: "OpenAI",
        level: "Operator",
        tag: "Prompting",
      },
    ],
  },
  {
    id: "learning-paths",
    label: "Cybersecurity Learning Paths",
    subtitle: "High-signal progression for beginners, defenders, and aspiring operators.",
    icon: ShieldCheck,
    accent: "from-fuchsia-400/25 via-blue-400/10 to-transparent",
    entries: [
      {
        title: "ZeroDay-Guardian Learning Track",
        description: "Move from foundations to applied practice with guided labs and measurable checkpoints.",
        href: "/learn",
        source: "ZeroDay-Guardian",
        level: "Foundational",
        tag: "Platform Path",
      },
      {
        title: "MITRE ATT&CK Defender",
        description: "Role-based training and skill development around defensive ATT&CK-aligned workflows.",
        href: "https://attack.mitre.org/resources/training/cti/",
        source: "MITRE",
        level: "Operator",
        tag: "Blue Team",
      },
      {
        title: "CISA Cybersecurity Training & Exercises",
        description: "Official readiness material for operators, analysts, and organizational security teams.",
        href: "https://www.cisa.gov/resources-tools/training",
        source: "CISA",
        level: "Operator",
        tag: "Training",
      },
    ],
  },
  {
    id: "premium-guides",
    label: "Premium Guides",
    subtitle: "Curated guides and internal assets built for practical execution, not passive reading.",
    icon: BookOpenCheck,
    accent: "from-amber-300/25 via-cyan-300/10 to-transparent",
    entries: [
      {
        title: "Blue Team Incident Response Playbook",
        description: "Concise operator-friendly playbook for first actions, containment, and escalation flow.",
        href: "/downloads/BlueTeam_Incident_Response_Playbook.md",
        source: "ZeroDay-Guardian",
        level: "Operator",
        tag: "Playbook",
      },
      {
        title: "Threat Hunting Query Cheatsheet",
        description: "Fast reference for translating hypotheses into practical hunting queries and pivots.",
        href: "/downloads/ThreatHunting_Query_CheatSheet.md",
        source: "ZeroDay-Guardian",
        level: "Advanced",
        tag: "Hunting",
      },
      {
        title: "Secure Automation Python Exercises",
        description: "Hands-on exercises for turning repetitive security tasks into controlled automation.",
        href: "/downloads/Secure_Automation_Python_Exercises.md",
        source: "ZeroDay-Guardian",
        level: "Operator",
        tag: "Automation",
      },
    ],
  },
];

const ResourcesPage = () => {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("ethical-hacking-tools");

  const active = useMemo(
    () => categories.find((category) => category.id === activeCategory) || categories[0],
    [activeCategory]
  );

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-[28px] border border-cyan-300/20 bg-[radial-gradient(circle_at_12%_12%,rgba(103,232,249,0.22),transparent_26%),radial-gradient(circle_at_82%_14%,rgba(59,130,246,0.2),transparent_30%),linear-gradient(180deg,rgba(6,10,19,0.96),rgba(4,7,14,0.98))] p-7 md:p-10 shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/85">
                <Sparkles className="h-3.5 w-3.5" />
                Expert Resource Vault
              </p>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
                Premium cybersecurity and AI security resources built for real operators
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-cyan-100/78 md:text-base">
                Curated high-value references, official frameworks, and practical internal guides for ethical hacking,
                AI security research, defensive operations, and structured learning.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                to="/lab"
                className="rounded-2xl border border-cyan-300/25 bg-white/5 px-4 py-4 text-sm text-cyan-50 transition hover:-translate-y-0.5 hover:border-cyan-300/45 hover:bg-cyan-400/10"
              >
                <strong className="block text-base">Launch Sandbox</strong>
                <span className="mt-1 block text-cyan-100/70">Put the references into practice with guided labs.</span>
              </Link>
              <Link
                to="/learn"
                className="rounded-2xl border border-cyan-300/25 bg-white/5 px-4 py-4 text-sm text-cyan-50 transition hover:-translate-y-0.5 hover:border-cyan-300/45 hover:bg-cyan-400/10"
              >
                <strong className="block text-base">Open Learning Path</strong>
                <span className="mt-1 block text-cyan-100/70">Move from fundamentals to field-ready workflows.</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-[24px] border border-cyan-300/16 bg-slate-950/70 p-4 backdrop-blur-md">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white">Structured Categories</h2>
              <p className="mt-1 text-sm text-cyan-100/65">Select a track to load expert-level references.</p>
            </div>

            <div className="grid gap-3">
              {categories.map((category) => {
                const Icon = category.icon;
                const selected = category.id === activeCategory;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveCategory(category.id)}
                    className={`group rounded-[20px] border px-4 py-4 text-left transition ${
                      selected
                        ? "border-cyan-300/45 bg-cyan-400/12 shadow-[0_18px_44px_rgba(34,211,238,0.12)]"
                        : "border-cyan-300/12 bg-white/[0.03] hover:-translate-y-0.5 hover:border-cyan-300/28 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${category.accent} text-cyan-100`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <strong className="block text-sm text-white">{category.label}</strong>
                        <p className="mt-1 text-xs leading-5 text-cyan-100/66">{category.subtitle}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="rounded-[26px] border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(8,13,24,0.92),rgba(5,8,16,0.96))] p-5 md:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/55">Active Collection</p>
                <h2 className="mt-2 text-2xl font-black text-white">{active.label}</h2>
                <p className="mt-2 max-w-3xl text-sm text-cyan-100/70">{active.subtitle}</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {active.entries.map((entry) => {
                const external = entry.href.startsWith("http");
                const Body = (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-cyan-300/18 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/72">
                        {entry.tag}
                      </span>
                      <span className="text-[11px] text-cyan-100/58">{entry.level}</span>
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-white">{entry.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-cyan-100/70">{entry.description}</p>
                    <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100">
                      {entry.source}
                      <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </>
                );

                return external ? (
                  <a
                    key={entry.title}
                    href={entry.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-[22px] border border-cyan-300/14 bg-white/[0.03] p-5 transition hover:-translate-y-1 hover:border-cyan-300/32 hover:bg-white/[0.05] hover:shadow-[0_20px_48px_rgba(0,0,0,0.22)]"
                  >
                    {Body}
                  </a>
                ) : (
                  <Link
                    key={entry.title}
                    to={entry.href}
                    className="group rounded-[22px] border border-cyan-300/14 bg-white/[0.03] p-5 transition hover:-translate-y-1 hover:border-cyan-300/32 hover:bg-white/[0.05] hover:shadow-[0_20px_48px_rgba(0,0,0,0.22)]"
                  >
                    {Body}
                  </Link>
                );
              })}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "Operator Focus",
                  text: "Every category is curated around practical output: testing, validation, incident response, and secure AI operations.",
                },
                {
                  title: "High-Signal Sources",
                  text: "Official frameworks and trusted references first, internal execution guides second, low-value filler removed.",
                },
                {
                  title: "Built for Action",
                  text: "Pair these resources with sandbox drills, guided chat mentoring, and the learning path to convert reading into capability.",
                },
              ].map((item) => (
                <article key={item.title} className="rounded-[20px] border border-cyan-300/12 bg-white/[0.03] p-4">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-100">
                    <Bot className="h-4 w-4" />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-cyan-100/68">{item.text}</p>
                </article>
              ))}
            </div>
          </section>
        </section>
      </div>
    </div>
  );
};

export default ResourcesPage;
