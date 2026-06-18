/**
 * CyberRoadmap — Interactive 60-Day Cybersecurity Learning Timeline
 *
 * Cyber Rationale: Visual roadmap reduces beginner confusion → lower bounce rate.
 * Shows all 60 days across 3 phases with locked/unlocked states, hover tooltips,
 * progress ring, and "Notify Me" email capture for locked days.
 */

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, CheckCircle2, PlayCircle, Bell, ChevronRight } from "lucide-react";
import { SYLLABUS_PHASES, TOTAL_DAYS, resolvePhase, ZORVIX_UI } from "@/lib/syllabusShared";
import ProgressRing from "@/components/progress/ProgressRing";

// ── Module-level constant for default empty set (avoids new Set() per render) ──
const EMPTY_SET = new Set<number>();

// ── Types ──
interface CyberRoadmapProps {
  /** Current day number (1-60). Days <= this are unlocked. */
  currentDay: number;
  /** Set of completed day numbers. */
  completedDays?: Set<number>;
  /** Called when a user clicks an unlocked day. */
  onDayClick?: (day: number) => void;
  /** Called when a user submits email for a locked day notification. */
  onNotifyMe?: (email: string, day: number) => void;
}

interface DayNode {
  day: number;
  phase: (typeof SYLLABUS_PHASES)[number];
  topic: string;
  isUnlocked: boolean;
  isCompleted: boolean;
  isCurrent: boolean;
}

// ── Phase colors by vector track (inline styles for JIT safety) ──
// Cyber Rationale: Uses inline styles with hex values from ZORVIX_UI so
// Tailwind JIT compiler doesn't need to safelist dynamic class strings.
const TRACK_STYLES: Record<string, { borderColor: string; bgColor: string; textColor: string; shadow: string; hex: string }> = {
  RECON: {
    borderColor: "rgba(0,240,255,0.30)",
    bgColor: "rgba(0,240,255,0.10)",
    textColor: ZORVIX_UI.cyberCyan,
    shadow: "0 0 12px rgba(0,240,255,0.25)",
    hex: ZORVIX_UI.cyberCyan,
  },
  APPSEC: {
    borderColor: "rgba(0,255,136,0.30)",
    bgColor: "rgba(0,255,136,0.10)",
    textColor: ZORVIX_UI.accentGreen,
    shadow: "0 0 12px rgba(0,255,136,0.25)",
    hex: ZORVIX_UI.accentGreen,
  },
  BINARY_PWN: {
    borderColor: "rgba(161,36,255,0.30)",
    bgColor: "rgba(161,36,255,0.10)",
    textColor: ZORVIX_UI.elitePurple,
    shadow: "0 0 12px rgba(161,36,255,0.25)",
    hex: ZORVIX_UI.elitePurple,
  },
};

const getTrackStyle = (track: string) => TRACK_STYLES[track] ?? TRACK_STYLES.RECON;

// ── Single Day Node ──
function DayNode({
  node,
  onDayClick,
  onNotifyMe,
}: {
  node: DayNode;
  onDayClick?: (day: number) => void;
  onNotifyMe?: (email: string, day: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [showNotify, setShowNotify] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const trackStyle = getTrackStyle(node.phase.vectorTrack);

  const handleClick = useCallback(() => {
    if (node.isCompleted || node.isUnlocked) {
      onDayClick?.(node.day);
    } else {
      setShowNotify((prev) => !prev);
    }
  }, [node.day, node.isCompleted, node.isUnlocked, onDayClick]);

  const handleNotifySubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (notifyEmail.includes("@")) {
        onNotifyMe?.(notifyEmail, node.day);
        setNotifyEmail("");
        setShowNotify(false);
      }
    },
    [notifyEmail, node.day, onNotifyMe],
  );

  return (
    <motion.div
      className="relative flex flex-col items-center"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      {/* Day button */}
      <motion.button
        type="button"
        onClick={handleClick}
        whileHover={node.isUnlocked ? { scale: 1.15 } : undefined}
        whileTap={node.isUnlocked ? { scale: 0.95 } : undefined}
        style={
          node.isCompleted
            ? { borderColor: trackStyle.borderColor, backgroundColor: trackStyle.bgColor, color: trackStyle.textColor, boxShadow: trackStyle.shadow }
            : node.isCurrent
              ? { borderColor: "rgba(0,240,255,0.60)", backgroundColor: "rgba(0,240,255,0.20)", color: "white", boxShadow: `0 0 0 2px rgba(34,211,238,0.30), ${trackStyle.shadow}` }
              : undefined
        }
        className={`relative flex h-10 w-10 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
          node.isCompleted
            ? ""              : node.isCurrent
              ? ""
              : node.isUnlocked
                ? "border-white/20 bg-white/[0.05] text-slate-200 hover:border-white/40 hover:bg-white/[0.1]"
                : "border-white/8 bg-white/[0.02] text-slate-600 cursor-not-allowed opacity-50"
        }`}
        aria-label={`Day ${node.day}: ${node.topic}${node.isCompleted ? " (completed)" : node.isUnlocked ? " (unlocked)" : " (locked)"}`}
      >
        {node.isCompleted ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : node.isCurrent ? (
          <PlayCircle className="h-4 w-4" />
        ) : node.isUnlocked ? (
          <span>{node.day}</span>
        ) : (
          <Lock className="h-3.5 w-3.5" />
        )}

        {/* Neon glow ring for current day */}
        {node.isCurrent && (
          <motion.span
            className="absolute inset-0 rounded-full border border-cyan-400/30"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.button>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 z-50 mb-2 w-44 -translate-x-1/2 rounded-xl border border-white/10 bg-[#0B111E] p-3 shadow-xl pointer-events-none"
          >
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Day {node.day}</p>
            <p className="mt-1 text-xs font-semibold text-white leading-snug">{node.topic}</p>
            <p className="mt-1 text-[10px]" style={{ color: trackStyle.textColor }}>
              {node.phase.name} • {node.phase.vectorTrack}
            </p>
            {!node.isUnlocked && (
              <p className="mt-1 text-[10px] text-amber-400/80">🔒 Complete Mission {String(node.day - 1).padStart(2, '0')} to unlock</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notify Me popup */}
      <AnimatePresence>
        {showNotify && !node.isUnlocked && (
          <motion.form
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            onSubmit={handleNotifySubmit}
            className="absolute top-full left-1/2 z-50 mt-2 w-52 -translate-x-1/2 rounded-xl border border-white/10 bg-[#0B111E] p-3 shadow-xl"
          >
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Notify when unlocked</p>
            <div className="mt-2 flex gap-2">
              <input
                type="email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="you@email.com"
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
                required
              />
              <button
                type="submit"
                className="flex items-center justify-center rounded-lg bg-cyan-500/20 px-2 py-1.5 text-cyan-300 transition-colors hover:bg-cyan-500/30"
              >
                <Bell className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Component ──
export default function CyberRoadmap({
  currentDay,
  completedDays,
  onDayClick,
  onNotifyMe,
}: CyberRoadmapProps) {
  const clampedDay = Math.max(1, Math.min(TOTAL_DAYS, currentDay));
  // Cyber Rationale: Module-level constant avoids creating a new Set reference
  // every render when the prop is omitted, which would cause unnecessary memo recomputation.
  const completedDaysRef = completedDays ?? EMPTY_SET;

  // Cyber Rationale: Spread Set into a stable array for useMemo deps —
  // React compares Set references, not contents, so passing a mutated Set
  // reference would cause the memo to silently skip re-computation.
  const completedArray = useMemo(() => [...completedDaysRef], [completedDaysRef]);
  const completedSet = useMemo(() => new Set(completedArray), [completedArray]);

  // Build day nodes with real syllabus data
  const nodes: DayNode[] = useMemo(() => {
    return Array.from({ length: TOTAL_DAYS }, (_, i) => {
      const day = i + 1;
      const { phase } = resolvePhase(day);
      const topicIndex = (day - phase.dayRange[0]) % phase.topics.length;
      return {
        day,
        phase,
        topic: phase.topics[topicIndex],
        isUnlocked: day <= clampedDay,
        isCompleted: completedSet.has(day),
        isCurrent: day === clampedDay && !completedSet.has(day),
      };
    });
  }, [clampedDay, completedSet]);

  const completedCount = completedArray.length;
  const progressPct = Math.round((completedCount / TOTAL_DAYS) * 100);

  return (
    <section
      data-reveal
      className="cyber-card overflow-hidden rounded-[32px] p-5 md:p-8"
      aria-label="60-Day Cybersecurity Roadmap"
    >
      {/* Header */}
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-cyan-300/85">
            60-Day Roadmap
          </p>
          <h2 className="glow-text text-2xl font-bold tracking-tight text-white md:text-3xl">
            Your Cybersecurity Journey
          </h2>
          <p className="max-w-xl text-sm leading-6 text-slate-300/85">
            Follow a structured path across 3 phases — from recon fundamentals to binary exploitation.
            Each day unlocks the next with validated progress.
          </p>
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 max-w-xs overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <span className="terminal-font text-xs text-slate-400">{progressPct}%</span>
          </div>
        </div>

        <ProgressRing current={completedCount} total={TOTAL_DAYS} label={`${completedCount}/${TOTAL_DAYS} days`} />
      </div>

      {/* Phase sections */}
      <div className="mt-8 space-y-8">
        {SYLLABUS_PHASES.map((phase) => {
          const phaseNodes = nodes.filter(
            (n) => n.day >= phase.dayRange[0] && n.day <= phase.dayRange[1],
          );
          const phaseCompleted = phaseNodes.filter((n) => n.isCompleted).length;
          const phaseTotal = phaseNodes.length;
          const phaseStyle = getTrackStyle(phase.vectorTrack);

          return (
            <div key={phase.id}>
              {/* Phase header */}
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border" style={{ borderColor: phaseStyle.borderColor, backgroundColor: phaseStyle.bgColor }}>
                  <span className="text-sm font-bold" style={{ color: phaseStyle.textColor }}>{phase.id}</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{phase.name}</h3>
                  <p className="text-[11px] text-slate-500">
                    Days {phase.dayRange[0]}–{phase.dayRange[1]} • {phaseCompleted}/{phaseTotal} completed
                  </p>
                </div>
                <div className="ml-auto hidden md:block">
                  <span className="text-[10px] uppercase tracking-widest opacity-60" style={{ color: phaseStyle.textColor }}>
                    {phase.vectorTrack}
                  </span>
                </div>
              </div>

              {/* Day nodes grid — responsive columns */}
              {/* Cyber Rationale: grid-cols-20 is not a default Tailwind utility;
                  use arbitrary value syntax to ensure 20 columns on md+ screens. */}
              {/* Cyber Rationale: Use xl breakpoint for 20-col layout; md stays at 10-col
                  to prevent overflow on 768–951px screens (20×40px+gaps = 952px). */}
              {/* Cyber Rationale: grid-cols-5 base for mobile (40px buttons need >37px cols);
                  sm: 10 cols for tablets; xl: 20 cols for desktop. */}
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-10 xl:grid-cols-[repeat(20,minmax(0,1fr))]">
                {phaseNodes.map((node) => (
                  <DayNode
                    key={node.day}
                    node={node}
                    onDayClick={onDayClick}
                    onNotifyMe={onNotifyMe}
                  />
                ))}
              </div>

              {/* Phase topics preview */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {phase.topics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full border px-2.5 py-0.5 text-[10px] opacity-50"
                    style={{ borderColor: phaseStyle.borderColor, color: phaseStyle.textColor }}
                  >
                    {topic}
                  </span>
                ))}
              </div>

              {/* Phase connector */}
              {phase.id < SYLLABUS_PHASES.length && (
                <div className="mt-4 flex justify-center">
                  <ChevronRight className="h-4 w-4 rotate-90 text-slate-600" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer CTA */}
      <div className="mt-8 text-center">
        <p className="text-sm text-slate-400">
          {completedCount === TOTAL_DAYS
            ? "🎉 You completed all 60 missions! You are a certified ZeroDay Guardian."
            : `Complete Mission ${String(clampedDay).padStart(2, '0')} to unlock the next step in your journey.`}
        </p>
      </div>
    </section>
  );
}
