/**
 * RoadmapPage — Wraps CyberRoadmap as a full page route.
 *
 * Cyber Rationale: Dedicated page for the 60-day interactive roadmap,
 * accessible at /roadmap. Shows learning path progression with locked/unlocked states.
 * Uses localStorage for progress tracking since roadmap state is user-specific
 * and doesn't require backend synchronization for the free/exploratory view.
 */
import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import CyberRoadmap from "@/components/Roadmap/CyberRoadmap";
import { useAuth } from "@/context/AuthContext";
import SEOManager from "@/components/SEOManager";

// ── Constants ──
const STORAGE_KEY_COMPLETED = "zdg:roadmap:completed";
const STORAGE_KEY_CURRENT = "zdg:roadmap:current";

// ── Helpers ──
const loadCompletedDays = (): Set<number> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMPLETED);
    if (!raw) return new Set<number>();
    return new Set<number>(JSON.parse(raw) as number[]);
  } catch {
    return new Set<number>();
  }
};

const loadCurrentDay = (): number => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CURRENT);
    if (!raw) return 1;
    const num = Number(raw);
    return Number.isFinite(num) ? Math.max(1, num) : 1;
  } catch {
    return 1;
  }
};

export default function RoadmapPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Load persisted progress from localStorage
  const completedDays = useMemo(() => loadCompletedDays(), []);
  const currentDay = useMemo(() => loadCurrentDay(), []);

  const handleDayClick = useCallback(
    (day: number) => {
      if (isAuthenticated) {
        navigate(`/program/day/${day}`);
      } else {
        navigate("/auth");
      }
    },
    [isAuthenticated, navigate],
  );

  const handleNotifyMe = useCallback((email: string, day: number) => {
    try {
      const existing = JSON.parse(localStorage.getItem("zdg:roadmap:notifications") || "[]");
      existing.push({ email, day, timestamp: new Date().toISOString() });
      localStorage.setItem("zdg:roadmap:notifications", JSON.stringify(existing));
    } catch {
      // Storage unavailable — silently fail
    }
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SEOManager
        title="60-Day Cyber Roadmap | ZeroDay Guardian"
        description="Follow a structured 60-day cybersecurity learning path — from recon fundamentals to binary exploitation."
        path="/roadmap"
        keywords="cybersecurity roadmap, 60-day plan, ethical hacking, learning path, cyber career"
      />
      <CyberRoadmap
        currentDay={currentDay}
        completedDays={completedDays}
        onDayClick={handleDayClick}
        onNotifyMe={handleNotifyMe}
      />
    </div>
  );
}
