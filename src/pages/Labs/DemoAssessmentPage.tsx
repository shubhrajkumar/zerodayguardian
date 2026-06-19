/**
 * DemoAssessmentPage — Cyber Security Readiness Assessment for unregistered visitors.
 *
 * Cyber Rationale: Free assessment builds trust, captures intent, and converts
 * visitors into signups by showing them a personalized learning path.
 * No backend required — all scoring logic is client-side.
 */
import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  Shield,
  Target,
  Terminal,
  UserCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// ── Types ──

type AssessmentAnswer = string;

interface AssessmentQuestion {
  id: string;
  question: string;
  options: Array<{
    value: string;
    label: string;
    scores: Record<string, number | string>;
  }>;
}

interface AssessmentResult {
  skillLevel: "beginner" | "intermediate" | "advanced";
  recommendedPath: {
    id: string;
    title: string;
    icon: string;
    description: string;
    focusScores: Record<string, number>;
    color: string;
    borderColor: string;
  };
  topFocusAreas: Array<{ name: string; score: number }>;
  totalScore: number;
  timeCommitment: string;
}

// ── Career Path Definitions ──

const CAREER_PATHS: Array<{
  id: string;
  title: string;
  icon: string;
  description: string;
  keySkills: string[];
  color: string;
  borderColor: string;
  accentColor: string;
  focusScores: Record<string, number>;
}> = [
  {
    id: "ethical-hacker",
    title: "Ethical Hacker",
    icon: "🔐",
    color: "from-cyan-500/20 to-blue-500/20",
    borderColor: "border-cyan-500/30",
    accentColor: "cyan",
    description:
      "You're wired for offensive security. Learn reconnaissance, web security, vulnerability discovery, and penetration testing to help organizations find weaknesses before attackers do.",
    keySkills: ["Penetration Testing", "Exploitation", "Reconnaissance", "Web Security"],
    focusScores: {},
  },
  {
    id: "bug-bounty",
    title: "Bug Bounty Hunter",
    icon: "🐛",
    color: "from-purple-500/20 to-pink-500/20",
    borderColor: "border-purple-500/30",
    accentColor: "purple",
    description:
      "You have a hunter's mindset. Learn how to identify, exploit, and responsibly report real-world vulnerabilities across web apps, APIs, and mobile platforms.",
    keySkills: ["Vulnerability Research", "Web Exploitation", "Report Writing", "Recon"],
    focusScores: {},
  },
  {
    id: "soc-analyst",
    title: "SOC Analyst",
    icon: "🛡️",
    color: "from-emerald-500/20 to-teal-500/20",
    borderColor: "border-emerald-500/30",
    accentColor: "emerald",
    description:
      "You're a natural defender. Master monitoring, threat detection, incident response, and blue-team operations to protect enterprise environments.",
    keySkills: ["Threat Detection", "Incident Response", "SIEM Operations", "Network Security"],
    focusScores: {},
  },
  {
    id: "osint-investigator",
    title: "OSINT Investigator",
    icon: "🔍",
    color: "from-amber-500/20 to-orange-500/20",
    borderColor: "border-amber-500/30",
    accentColor: "amber",
    description:
      "You have an investigator's eye. Learn digital investigations, intelligence gathering, online footprint analysis, and threat intelligence tradecraft.",
    keySkills: ["OSINT Collection", "Digital Forensics", "Threat Intelligence", "Data Analysis"],
    focusScores: {},
  },
];

// ── Assessment Questions ──

const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: "experience",
    question: "How would you describe your current experience with cyber security?",
    options: [
      { value: "none", label: "Never studied it — I'm completely new", scores: { beginner: 5, _skill: 1 } },
      { value: "some-courses", label: "I've done some online courses or tutorials", scores: { beginner: 3, intermediate: 2, _skill: 2 } },
      { value: "ctf-labs", label: "I've participated in CTFs or lab challenges", scores: { intermediate: 4, advanced: 1, _skill: 3 } },
      { value: "it-professional", label: "I work in IT or cyber security already", scores: { advanced: 4, intermediate: 1, _skill: 4 } },
    ],
  },
  {
    id: "interest",
    question: "Which area of cyber security interests you the most?",
    options: [
      { value: "breaking", label: "Breaking into systems and finding vulnerabilities", scores: { ethical_hacker: 5, bug_bounty: 3, recon: 3, web: 4, exploitation: 5 } },
      { value: "bug-hunting", label: "Finding and reporting bugs for bounties", scores: { bug_bounty: 5, ethical_hacker: 3, web: 4, exploitation: 4 } },
      { value: "defending", label: "Defending networks and monitoring threats", scores: { soc_analyst: 5, defense: 5, ir: 4, network: 3 } },
      { value: "investigating", label: "Investigating digital footprints and gathering intel", scores: { osint: 5, osint_investigator: 5, forensics: 3 } },
    ],
  },
  {
    id: "linux",
    question: "What's your comfort level with the Linux command line?",
    options: [
      { value: "never", label: "Never used it", scores: { beginner: 3, _skill: 1 } },
      { value: "basic", label: "Basic commands (ls, cd, grep)", scores: { intermediate: 2, recon: 2, _skill: 2 } },
      { value: "regular", label: "Regular user — comfortable in the terminal", scores: { intermediate: 3, recon: 3, exploitation: 2, _skill: 3 } },
      { value: "power", label: "Power user — scripting and automation", scores: { advanced: 3, exploitation: 3, cloud: 2, _skill: 4 } },
    ],
  },
  {
    id: "programming",
    question: "Do you have programming or scripting experience?",
    options: [
      { value: "none", label: "None", scores: { beginner: 2, _skill: 1 } },
      { value: "basic-scripting", label: "Basic scripting (Bash, Python basics)", scores: { intermediate: 2, web: 2, exploitation: 1, _skill: 2 } },
      { value: "competent", label: "Competent in one or more languages", scores: { intermediate: 2, advanced: 1, web: 3, exploitation: 2, _skill: 3 } },
      { value: "professional", label: "Professional developer or engineer", scores: { advanced: 3, web: 3, exploitation: 2, cloud: 2, _skill: 4 } },
    ],
  },
  {
    id: "networking",
    question: "How familiar are you with networking concepts?",
    options: [
      { value: "none", label: "Not familiar — I'm new to networking", scores: { beginner: 3, _skill: 1 } },
      { value: "basics", label: "Basic understanding (IP, DNS, ports)", scores: { intermediate: 2, network: 2, recon: 2, _skill: 2 } },
      { value: "comfortable", label: "Comfortable with TCP/IP, routing, subnetting", scores: { intermediate: 2, network: 4, recon: 3, defense: 2, _skill: 3 } },
      { value: "expert", label: "Expert — I design or manage networks", scores: { advanced: 3, network: 5, defense: 3, cloud: 3, _skill: 4 } },
    ],
  },
  {
    id: "time",
    question: "How much time can you dedicate to learning per week?",
    options: [
      { value: "casual", label: "1–2 hours — casual learning", scores: { _time: "casual" } },
      { value: "regular", label: "3–5 hours — regular practice", scores: { _time: "regular" } },
      { value: "dedicated", label: "6–10 hours — dedicated study", scores: { _time: "dedicated" } },
      { value: "intensive", label: "10+ hours — intensive training", scores: { _time: "intensive" } },
    ],
  },
  {
    id: "style",
    question: "What's your preferred learning style?",
    options: [
      { value: "hands-on", label: "Hands-on labs and practical exercises", scores: { _style: "practical" } },
      { value: "reading", label: "Reading documentation and watching videos", scores: { _style: "theoretical" } },
      { value: "guided", label: "Guided courses with structured curriculum", scores: { _style: "structured" } },
      { value: "challenge", label: "Challenge-based — CTFs and capture the flag", scores: { _style: "ctf" } },
    ],
  },
  {
    id: "mindset",
    question: "Which mindset resonates more with you?",
    options: [
      { value: "offensive", label: "Finding how things break — offensive mindset", scores: { ethical_hacker: 4, bug_bounty: 3, exploitation: 4, web: 2 } },
      { value: "defensive", label: "Making things secure — defensive mindset", scores: { soc_analyst: 4, defense: 5, ir: 3, network: 2 } },
      { value: "investigative", label: "Finding evidence and connecting dots", scores: { osint: 5, osint_investigator: 4, forensics: 3 } },
      { value: "balanced", label: "Both — I want to understand the full picture", scores: { ethical_hacker: 2, soc_analyst: 2, osint: 2, defense: 2, exploitation: 2 } },
    ],
  },
];

// ── Scoring Helpers ──

const scoreResult = (answers: Record<string, AssessmentAnswer>): AssessmentResult => {
  const scores: Record<string, number> = {};
  let skillPoints = 0;
  let timeCommitment = "regular";

  for (const [qId, answer] of Object.entries(answers)) {
    const question = ASSESSMENT_QUESTIONS.find((q) => q.id === qId);
    if (!question) continue;
    const option = question.options.find((o) => o.value === answer);
    if (!option) continue;

    for (const [key, val] of Object.entries(option.scores)) {
      if (key === "_skill") {
        skillPoints += val as number;
      } else if (key === "_time") {
        timeCommitment = val as string;
      } else {
        scores[key] = (scores[key] || 0) + (val as number);
      }
    }
  }

  // Determine skill level
  const maxSkill = 16; // Sum of max _skill scores across experience, linux, programming, networking questions
  const skillRatio = skillPoints / maxSkill;
  const skillLevel = skillRatio < 0.4 ? "beginner" : skillRatio < 0.7 ? "intermediate" : "advanced";

  // Determine recommended career path
  const pathScores = {
    "ethical-hacker": (scores.ethical_hacker || 0) + (scores.exploitation || 0) * 0.5 + (scores.web || 0) * 0.3,
    "bug-bounty": (scores.bug_bounty || 0) + (scores.web || 0) * 0.4 + (scores.exploitation || 0) * 0.3,
    "soc-analyst": (scores.soc_analyst || 0) + (scores.defense || 0) * 0.5 + (scores.network || 0) * 0.3 + (scores.ir || 0) * 0.4,
    "osint-investigator": (scores.osint_investigator || 0) + (scores.osint || 0) * 0.5 + (scores.forensics || 0) * 0.3,
  };

  const bestPathId = Object.entries(pathScores).sort((a, b) => b[1] - a[1])[0][0];
  const recommendedPath = (CAREER_PATHS.find((p) => p.id === bestPathId) || CAREER_PATHS[0]) as AssessmentResult['recommendedPath'];

  // Top focus areas
  const focusMap: Record<string, string> = {
    recon: "Reconnaissance",
    web: "Web Security",
    network: "Network Security",
    exploitation: "Exploitation",
    defense: "Defense",
    osint: "OSINT",
    forensics: "Forensics",
    cloud: "Cloud Security",
    ir: "Incident Response",
  };

  const topFocusAreas = Object.entries(scores)
    .filter(([key]) => focusMap[key])
    .map(([key, score]) => ({ name: focusMap[key], score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const totalScore = Object.values(scores).reduce((sum, v) => sum + v, 0);

  return {
    skillLevel,
    recommendedPath,
    topFocusAreas,
    totalScore,
    timeCommitment,
  };
};

// ── Sub-components ──

const ProgressBar = ({ current, total }: { current: number; total: number }) => {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
};

const SKILL_BADGE_CONFIG = {
  beginner: { label: "Beginner", color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  intermediate: { label: "Intermediate", color: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" },
  advanced: { label: "Advanced", color: "border-purple-500/30 bg-purple-500/10 text-purple-300" },
};

const SkillLevelBadge = ({ level }: { level: string }) => {
  const config = SKILL_BADGE_CONFIG[level as keyof typeof SKILL_BADGE_CONFIG] || SKILL_BADGE_CONFIG.beginner;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${config.color}`}>
      {config.label}
    </span>
  );
};

// ── Main Component ──

export default function DemoAssessmentPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<"welcome" | "questions" | "results">("welcome");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AssessmentAnswer>>({});
  const [selectedOption, setSelectedOption] = useState<AssessmentAnswer | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const totalQuestions = ASSESSMENT_QUESTIONS.length;
  const currentQuestion = ASSESSMENT_QUESTIONS[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  const handleStart = useCallback(() => {
    setCurrentStep("questions");
    setCurrentQuestionIndex(0);
  }, []);

  const handleOptionSelect = useCallback((value: string) => {
    setSelectedOption(value);
  }, []);

  const handleNext = useCallback(() => {
    if (!selectedOption || !currentQuestion) return;

    setTransitioning(true);
    const newAnswers = { ...answers, [currentQuestion.id]: selectedOption };
    setAnswers(newAnswers);

    setTimeout(() => {
      if (isLastQuestion) {
        const scored = scoreResult(newAnswers);
        setResult(scored);
        setCurrentStep("results");
      } else {
        setCurrentQuestionIndex((i) => i + 1);
        setSelectedOption(null);
      }
      setTransitioning(false);
    }, 300);
  }, [selectedOption, currentQuestion, answers, isLastQuestion]);

  const handleRestart = useCallback(() => {
    setAnswers({});
    setSelectedOption(null);
    setResult(null);
    setCurrentQuestionIndex(0);
    setCurrentStep("welcome");
  }, []);

  // ── Welcome Screen ──
  if (currentStep === "welcome") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-cyan-300">
            <Target className="h-3 w-3" />
            Free Readiness Assessment
          </div>
          <h1 className="text-3xl font-bold text-white md:text-4xl">
            Find Your Cyber Security Path
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-400">
            Answer 8 quick questions and we'll assess your readiness, recommend a
            career path, and build a personalized learning roadmap — no account required.
          </p>

          <div className="mx-auto mt-8 grid max-w-lg gap-3 text-left">
            {[
              { icon: UserCheck, text: "Discover your ideal cyber security career path" },
              { icon: Target, text: "Understand your current skill level" },
              { icon: Terminal, text: "Get a personalized learning roadmap" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <item.icon className="h-5 w-5 shrink-0 text-cyan-400" />
                <span className="text-sm text-slate-300">{item.text}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleStart}
            className="mt-8 inline-flex min-h-[56px] min-w-[200px] items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-8 py-3 text-sm font-bold uppercase tracking-[0.18em] text-black transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98]"
          >
            Start Assessment
            <ArrowRight className="h-4 w-4" />
          </button>

          <p className="mt-4 text-xs text-slate-500">
            Takes about 3 minutes. No sign-up required.
          </p>
        </div>
      </div>
    );
  }

  // ── Questions Screen ──
  if (currentStep === "questions" && currentQuestion) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Question {currentQuestionIndex + 1} of {totalQuestions}</span>
            <span>{Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100)}%</span>
          </div>
          <div className="mt-2">
            <ProgressBar current={currentQuestionIndex + 1} total={totalQuestions} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
          >
            <h2 className="text-xl font-semibold text-white md:text-2xl">
              {currentQuestion.question}
            </h2>

            <div className="mt-6 space-y-3">
              {currentQuestion.options.map((option) => {
                const isSelected = selectedOption === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleOptionSelect(option.value)}
                    className={`w-full rounded-xl border px-5 py-4 text-left text-sm transition-all duration-200 ${
                      isSelected
                        ? "border-cyan-400/50 bg-cyan-500/10 text-white shadow-[0_0_20px_rgba(6,182,212,0.08)]"
                        : "border-white/8 bg-white/[0.03] text-slate-300 hover:border-cyan-400/30 hover:bg-cyan-500/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          isSelected
                            ? "border-cyan-400 bg-cyan-400/20"
                            : "border-slate-600"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="h-3 w-3 text-cyan-300" />}
                      </div>
                      <span>{option.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (currentQuestionIndex > 0) {
                    setTransitioning(true);
                    setTimeout(() => {
                      setCurrentQuestionIndex((i) => i - 1);
                      const prevAnswer = answers[ASSESSMENT_QUESTIONS[currentQuestionIndex - 1]?.id];
                      setSelectedOption(prevAnswer || null);
                      setTransitioning(false);
                    }, 200);
                  }
                }}
                disabled={currentQuestionIndex === 0 || transitioning}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-slate-300 transition-colors hover:border-cyan-400/30 hover:text-cyan-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!selectedOption || transitioning}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-2.5 text-sm font-semibold text-black transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100"
              >
                {isLastQuestion ? "See Results" : "Next"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // ── Results Screen ──
  if (currentStep === "results" && result) {
    const path = result.recommendedPath;
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Hero Result */}
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            Assessment Complete
          </div>
          <h1 className="text-3xl font-bold text-white md:text-4xl">
            Your Results Are Ready
          </h1>
        </div>

        {/* Skill Level + Path Card */}
        <div className={`mt-8 rounded-2xl border ${path.borderColor} ${path.color} p-6 md:p-8`}>
          <div className="flex flex-col items-center gap-4 text-center md:flex-row md:text-left">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-3xl">
              {path.icon}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold text-white">{path.title}</h2>
                <SkillLevelBadge level={result.skillLevel} />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300/85">
                {path.description}
              </p>
            </div>
          </div>
        </div>

        {/* Focus Areas */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-300">Your Top Focus Areas</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {result.topFocusAreas.map((area) => (
              <div
                key={area.name}
                className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{area.name}</span>
                  <span className="text-xs font-medium text-cyan-300">
                    {Math.round((area.score / result.totalScore) * 100)}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${(area.score / result.totalScore) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended First Steps */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="text-sm font-semibold text-white">Recommended First Steps</h3>
          <div className="mt-4 space-y-3">
            {[
              { icon: Terminal, text: "Complete the free Nmap demo lab — it's the same first mission our registered users start with" },
              { icon: Target, text: `Follow the ${path.title} path — ${result.skillLevel === "beginner" ? "start with Recon Initiation" : result.skillLevel === "intermediate" ? "skip ahead to Web Attack Surface Discovery" : "begin with advanced exploitation missions"}` },
              { icon: Eye, text: "Create a free account to unlock all 60 missions, AI mentorship, and full sandbox access" },
            ].map((step) => (
              <div key={step.text} className="flex items-start gap-3">
                <step.icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                <span className="text-sm leading-6 text-slate-400">{step.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Group */}
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => navigate("/labs/demo-nmap")}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-6 py-2.5 text-sm font-semibold text-cyan-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/50 hover:bg-cyan-500/15 active:scale-[0.98]"
          >
            <Terminal className="h-4 w-4" />
            Try Free Lab
          </button>
          <button
            type="button"
            onClick={() => navigate("/auth")}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-2.5 text-sm font-bold uppercase tracking-[0.14em] text-black transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Shield className="h-4 w-4" />
            Create Free Account
          </button>
          <button
            type="button"
            onClick={handleRestart}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-slate-400 transition-colors hover:border-white/20 hover:text-slate-300"
          >
            Retake Assessment
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Already have an account?{" "}
          <a href="/auth" className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300">
            Sign in
          </a>
        </p>
      </div>
    );
  }

  // Fallback — should never reach here
  return null;
}
