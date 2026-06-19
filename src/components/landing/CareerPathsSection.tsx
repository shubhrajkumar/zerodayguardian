import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bug, Compass, Globe, Radar, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { staggerContainer, staggerItem, tapScale, cardHover } from "@/lib/animations";

interface CareerPath {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  target: string;
  difficulty: string;
  level: string;
  rewards: string;
  skills: string[];
  color: string;
}

const careerPaths: CareerPath[] = [
  {
    id: "ethical-hacker",
    icon: Radar,
    title: "Ethical Hacker",
    description: "Recon, web security, and penetration testing from beginner to pro.",
    target: "Become a certified pentester",
    difficulty: "Beginner",
    level: "Beginner → Advanced",
    rewards: "CEH, OSCP-aligned skills",
    skills: ["Recon", "Web Security", "Vulnerability Assessment"],
    color: "emerald",
  },
  {
    id: "bug-bounty",
    icon: Bug,
    title: "Bug Bounty Hunter",
    description: "Identify and responsibly report real-world vulnerabilities for rewards.",
    target: "Earn bounties on HackerOne",
    difficulty: "Intermediate",
    level: "Intermediate",
    rewards: "Real-world CVEs + cash",
    skills: ["Vuln Research", "Exploit Analysis", "Report Writing"],
    color: "cyan",
  },
  {
    id: "soc-analyst",
    icon: Shield,
    title: "SOC Analyst",
    description: "Monitor, detect threats, and lead incident response operations.",
    target: "Join a SOC team",
    difficulty: "Beginner",
    level: "Beginner → Intermediate",
    rewards: "Security+, CySA+ aligned",
    skills: ["Threat Detection", "SIEM", "Incident Response"],
    color: "purple",
  },
  {
    id: "osint-investigator",
    icon: Globe,
    title: "OSINT Investigator",
    description: "Digital investigations, intel gathering, and footprint analysis.",
    target: "Conduct intel ops",
    difficulty: "All Levels",
    level: "All Levels",
    rewards: "OSINT tool mastery",
    skills: ["Intel Gathering", "Footprinting", "Data Correlation"],
    color: "amber",
  },
];

const colorMap: Record<string, { border: string; bg: string; text: string; icon: string; tagBorder: string; tagBg: string; tagText: string; skillBg: string; skillText: string }> = {
  emerald: {
    border: "group-hover:border-emerald-500/40",
    bg: "group-hover:bg-emerald-500/[0.03]",
    text: "group-hover:text-emerald-300",
    icon: "text-emerald-400 border-slate-700/60 bg-slate-800/40",
    tagBorder: "border-emerald-500/20",
    tagBg: "bg-emerald-500/10",
    tagText: "text-emerald-300",
    skillBg: "bg-emerald-900/20",
    skillText: "text-emerald-300/80",
  },
  cyan: {
    border: "group-hover:border-cyan-500/40",
    bg: "group-hover:bg-cyan-500/[0.03]",
    text: "group-hover:text-cyan-300",
    icon: "text-cyan-400 border-slate-700/60 bg-slate-800/40",
    tagBorder: "border-cyan-500/20",
    tagBg: "bg-cyan-500/10",
    tagText: "text-cyan-300",
    skillBg: "bg-cyan-900/20",
    skillText: "text-cyan-300/80",
  },
  purple: {
    border: "group-hover:border-purple-500/40",
    bg: "group-hover:bg-purple-500/[0.03]",
    text: "group-hover:text-purple-300",
    icon: "text-purple-400 border-slate-700/60 bg-slate-800/40",
    tagBorder: "border-purple-500/20",
    tagBg: "bg-purple-500/10",
    tagText: "text-purple-300",
    skillBg: "bg-purple-900/20",
    skillText: "text-purple-300/80",
  },
  amber: {
    border: "group-hover:border-amber-500/40",
    bg: "group-hover:bg-amber-500/[0.03]",
    text: "group-hover:text-amber-300",
    icon: "text-amber-400 border-slate-700/60 bg-slate-800/40",
    tagBorder: "border-amber-500/20",
    tagBg: "bg-amber-500/10",
    tagText: "text-amber-300",
    skillBg: "bg-amber-900/20",
    skillText: "text-amber-300/80",
  },
};

const CareerPathsSection = () => {
  const navigate = useNavigate();
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="career-paths" className="relative px-4 py-16 md:py-24 overflow-hidden">
      {/* Subtle gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 right-0 w-[40%] aspect-square rounded-full opacity-[0.04] blur-[100px]"
          style={{ background: "radial-gradient(circle, rgba(34, 211, 238, 0.3), transparent 70%)" }}
        />
      </div>

      <div className="mx-auto max-w-6xl relative z-10">
        {/* Section header */}
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-2.5 rounded-full border border-slate-700/40 bg-slate-800/30 px-4 py-1.5 mb-6">
            <Compass className="h-3 w-3 text-emerald-400" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Career Paths
            </span>
          </div>
          <h2 className="text-3xl font-bold tracking-[-0.04em] text-slate-100 md:text-4xl">
            Choose Your{" "}
            <span className="gradient-text-cyan">Cyber Security Path</span>
          </h2>
          <p className="mt-4 text-xs leading-5 text-slate-400 max-w-lg mx-auto">
            Pick your specialization. Each path has curated missions, labs, and skill validation to get you job-ready.
          </p>
        </motion.div>

        {/* Career path cards */}
        <motion.div
          ref={ref}
          className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4"
          variants={staggerContainer}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          {careerPaths.map((path, i) => {
            const Icon = path.icon;
            const colors = colorMap[path.color] || colorMap.emerald;
            return (
              <motion.button
                key={path.id}
                type="button"
                onClick={() => navigate("/auth")}
                variants={staggerItem}
                whileHover={cardHover}
                whileTap={tapScale}
                className={`group flex flex-col rounded-xl border border-slate-800/50 bg-slate-900/30 p-4 md:p-5 text-left ${colors.border} ${colors.bg}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border ${colors.icon}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`shrink-0 rounded-md border ${colors.tagBorder} ${colors.tagBg} px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.14em] ${colors.tagText}`}>
                    {path.difficulty}
                  </span>
                </div>

                <h3 className={`mt-3 text-sm font-semibold text-slate-100 transition-colors ${colors.text}`}>
                  {path.title}
                </h3>
                <p className="mt-1 text-[11px] leading-4 text-slate-400">{path.description}</p>

                {/* Compact 3-bullet target card */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="shrink-0 text-slate-500">🎯</span>
                    <span className="text-slate-300">{path.target}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="shrink-0 text-slate-500">📊</span>
                    <span className="text-slate-300">{path.level}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="shrink-0 text-slate-500">🏆</span>
                    <span className="text-slate-300">{path.rewards}</span>
                  </div>
                </div>

                <div className="mt-auto pt-3">
                  <div className="flex flex-wrap gap-1">
                    {path.skills.map((skill) => (
                      <span
                        key={skill}
                        className={`rounded-md ${colors.skillBg} px-1.5 py-0.5 text-[9px] font-medium ${colors.skillText}`}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default CareerPathsSection;
