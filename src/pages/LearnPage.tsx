import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Clock3,
  Radar,
  Search,
  ShieldCheck,
  Target,
  TerminalSquare,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiGetJson } from "@/lib/apiClient";
import { pyGetJson } from "@/lib/pyApiClient";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useMissionSystem } from "@/context/MissionSystemApiContext";
import { useAuth } from "@/context/AuthContext";

type DashboardLite = {
  intelligence?: {
    xp?: number;
    proficiency?: number;
    completedLabs?: number;
    totalLabsTouched?: number;
  };
};

type AdaptiveRecommendationPayload = {
  generated_at: string;
  learning?: {
    weak_skills?: Array<{ key: string; label: string; score: number }>;
    suggested_paths?: Array<{ id: string; title: string; track: string; difficulty: string }>;
    next_missions?: Array<{ lesson_id: string; lesson_title: string; module_title: string; estimated_minutes?: number }>;
  };
  recommendations?: Array<{ title: string; reason: string; action: string }>;
};

type CourseItem = {
  id: string;
  title: string;
  difficulty: string;
  description: string;
  progress: number;
};

type CoursesResponse = {
  courses?: CourseItem[];
};

type LearningPathItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  track: string;
  version: number;
  is_active: boolean;
};

type MissionItem = {
  id: string;
  title: string;
  module_id: string;
  module_title: string;
  path_id: string;
  path_title: string;
  lesson_type: string;
  estimated_minutes: number;
};

type FilterKey = "All" | "Beginner" | "Intermediate" | "Advanced" | "Defense";

type TrackCardModel = {
  id: string;
  title: string;
  description: string;
  difficulty: FilterKey;
  totalHours: number;
  lessons: number;
  icon: LucideIcon;
  enrolledProgress: number;
  tags: string[];
};

const FILTERS: FilterKey[] = ["All", "Beginner", "Intermediate", "Advanced", "Defense"];

const getTrackDifficulty = (title: string, tags: string[]): FilterKey => {
  const normalized = `${title} ${tags.join(" ")}`.toLowerCase();
  if (
    normalized.includes("soc") ||
    normalized.includes("siem") ||
    normalized.includes("defense") ||
    normalized.includes("malware") ||
    normalized.includes("phishing") ||
    normalized.includes("log")
  ) {
    return "Defense";
  }
  if (normalized.includes("advanced") || normalized.includes("exploitation")) {
    return "Advanced";
  }
  if (normalized.includes("beginner") || normalized.includes("intro")) {
    return "Beginner";
  }
  return "Intermediate";
};

const getTrackIcon = (title: string, tags: string[]): LucideIcon => {
  const normalized = `${title} ${tags.join(" ")}`.toLowerCase();
  if (normalized.includes("ai")) return Brain;
  if (normalized.includes("log") || normalized.includes("siem") || normalized.includes("defense")) return ShieldCheck;
  if (normalized.includes("nmap") || normalized.includes("recon")) return Radar;
  if (normalized.includes("web") || normalized.includes("exploit")) return TerminalSquare;
  if (normalized.includes("labs") || normalized.includes("practice")) return Target;
  return BookOpen;
};

const getTrackHours = (difficulty: FilterKey, resourceCount: number, tagCount: number) => {
  const base = difficulty === "Beginner" ? 8 : difficulty === "Intermediate" ? 14 : difficulty === "Advanced" ? 20 : 18;
  return base + resourceCount + Math.max(0, tagCount - 2);
};

const getCourseFilter = (course: CourseItem): FilterKey => {
  const normalized = `${course.title} ${course.description}`.toLowerCase();
  if (normalized.includes("government") || normalized.includes("defense") || normalized.includes("soc")) {
    return "Defense";
  }
  if (course.difficulty === "Beginner" || normalized.includes("intro")) return "Beginner";
  if (course.difficulty === "Advanced") return "Advanced";
  return "Intermediate";
};

const trimDescription = (description: string) => {
  if (description.length <= 110) return description;
  return `${description.slice(0, 107).trim()}...`;
};

const LearnPage = () => {
  const navigate = useNavigate();
  const { recordAction } = useMissionSystem();
  const { authState, isAuthenticated } = useAuth();
  const [stats, setStats] = useState<DashboardLite["intelligence"] | null>(null);
  const [adaptive, setAdaptive] = useState<AdaptiveRecommendationPayload | null>(null);
  const [liveCourses, setLiveCourses] = useState<CourseItem[]>([]);
  const [livePaths, setLivePaths] = useState<LearningPathItem[]>([]);
  const [liveMissions, setLiveMissions] = useState<MissionItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("All");
  const [enrolledTrackProgress, setEnrolledTrackProgress] = useState<Record<string, number>>({});
  const [learningReady, setLearningReady] = useState(false);
  useScrollReveal([searchTerm, activeFilter, Boolean(adaptive)]);

  useEffect(() => {
    if (authState === "loading") return;

    if (!isAuthenticated) {
      setLiveCourses([]);
      setLivePaths([]);
      setLiveMissions([]);
      setLearningReady(true);
      return;
    }

    let active = true;

    const load = async () => {
      const [dashboardResult, adaptiveResult, coursesResult, pathsResult, missionsResult] = await Promise.allSettled([
        apiGetJson<DashboardLite>("/api/intelligence/dashboard"),
        pyGetJson<AdaptiveRecommendationPayload>("/adaptive/recommendations"),
        pyGetJson<CoursesResponse>("/courses"),
        pyGetJson<LearningPathItem[]>("/learning/paths"),
        pyGetJson<MissionItem[]>("/missions"),
      ]);

      if (!active) return;

      if (dashboardResult.status === "fulfilled") {
        setStats(dashboardResult.value.intelligence || null);
      } else {
        setStats(null);
      }

      if (adaptiveResult.status === "fulfilled") {
        setAdaptive(adaptiveResult.value);
      } else {
        setAdaptive(null);
      }

      if (coursesResult.status === "fulfilled") {
        setLiveCourses(Array.isArray(coursesResult.value.courses) ? coursesResult.value.courses : []);
      } else {
        setLiveCourses([]);
      }

      if (pathsResult.status === "fulfilled") {
        setLivePaths(Array.isArray(pathsResult.value) ? pathsResult.value : []);
      } else {
        setLivePaths([]);
      }

      if (missionsResult.status === "fulfilled") {
        setLiveMissions(Array.isArray(missionsResult.value) ? missionsResult.value : []);
      } else {
        setLiveMissions([]);
      }

      setLearningReady(true);
    };

    load().catch(() => {
      if (!active) return;
      setStats(null);
      setAdaptive(null);
      setLiveCourses([]);
      setLivePaths([]);
      setLiveMissions([]);
      setLearningReady(true);
    });

    recordAction("recommendation_reviewed", { target: "learn_page" }).catch(() => undefined);

    return () => {
      active = false;
    };
  }, [authState, isAuthenticated, recordAction]);

  const highlightedRecommendation = adaptive?.recommendations?.[0] || null;

  const trackCards = useMemo<TrackCardModel[]>(
    () =>
      livePaths.map((track, index) => {
        const tags = [track.track, track.difficulty, `v${track.version}`].filter(Boolean);
        const trackMissionCount = liveMissions.filter((mission) => mission.path_id === track.id).length;
        const difficulty = getTrackDifficulty(track.title, tags);
        const suggestedProgress = adaptive?.learning?.suggested_paths?.some((path) =>
          path.title.toLowerCase().includes(track.title.toLowerCase()) || track.title.toLowerCase().includes(path.title.toLowerCase())
        )
          ? 42
          : 0;
        const enrolledProgress =
          enrolledTrackProgress[track.id] ??
          (index === 0 && (stats?.completedLabs || 0) > 0 ? 28 : suggestedProgress);

        return {
          id: track.id,
          title: track.title,
          description: track.description || "Live learning path synced from the backend catalog.",
          difficulty,
          totalHours: getTrackHours(difficulty, trackMissionCount, tags.length),
          lessons: Math.max(4, trackMissionCount || 4),
          icon: getTrackIcon(track.title, tags),
          enrolledProgress,
          tags,
        };
      }),
    [adaptive?.learning?.suggested_paths, enrolledTrackProgress, liveMissions, livePaths, stats?.completedLabs]
  );

  const featuredCourses = useMemo(() => {
    return liveCourses.map((course, index) => ({
      ...course,
      filterDifficulty: getCourseFilter(course),
      duration: `${Math.max(2, 4 + index * 2)}h`,
      lessons: Math.max(6, 8 + index * 3),
    }));
  }, [liveCourses]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredTracks = useMemo(() => {
    return trackCards.filter((track) => {
      const matchesFilter = activeFilter === "All" || track.difficulty === activeFilter;
      const matchesSearch =
        !normalizedSearch ||
        track.title.toLowerCase().includes(normalizedSearch) ||
        track.description.toLowerCase().includes(normalizedSearch) ||
        track.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, normalizedSearch, trackCards]);

  const filteredCourses = useMemo(() => {
    return featuredCourses.filter((course) => {
      const matchesFilter = activeFilter === "All" || course.filterDifficulty === activeFilter;
      const matchesSearch =
        !normalizedSearch ||
        course.title.toLowerCase().includes(normalizedSearch) ||
        course.description.toLowerCase().includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, featuredCourses, normalizedSearch]);

  const programHighlights = useMemo(() => {
    const grouped = liveMissions.reduce<Record<string, MissionItem[]>>((accumulator, mission) => {
      const key = mission.path_title || "Guided Path";
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(mission);
      return accumulator;
    }, {});

    return Object.entries(grouped)
      .slice(0, 3)
      .map(([label, missions], index) => ({
        label,
        dayRange: `Stage ${index + 1} | ${missions.length} missions`,
        mission: missions[0]?.title || "Structured mission flow",
        challenge: missions[missions.length - 1]?.module_title || "Validated challenge",
      }));
  }, [liveMissions]);

  const totalProgramHours = useMemo(() => {
    const totalMinutes = liveMissions.reduce((sum, mission) => sum + Number(mission.estimated_minutes || 0), 0);
    return Math.max(1, Math.round(totalMinutes / 60));
  }, [liveMissions]);

  const handleTrackAction = (trackId: string, progress: number) => {
    if (!progress) {
      setEnrolledTrackProgress((current) => ({ ...current, [trackId]: 12 }));
      recordAction("learn_track_started", { target: trackId }).catch(() => undefined);
    } else {
      recordAction("learn_track_completed", { target: trackId }).catch(() => undefined);
    }
    navigate("/program");
  };

  const handleCourseAction = (courseTitle: string) => {
    recordAction("learn_track_started", { target: courseTitle }).catch(() => undefined);
    navigate("/program");
  };

  return (
    <div className="container grid-bg mx-auto px-4 py-10 page-shell md:py-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <section
          data-reveal
          className="cyber-card fadeInUp scanLine overflow-hidden rounded-[32px] p-5 md:p-7"
        >
          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
            <div className="space-y-4">
              <div>
                <p className="terminal-font text-[11px] uppercase tracking-[0.26em] text-slate-300/64">ZeroDay_Guardian Learning</p>
                <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.05em] text-white md:text-5xl">
                  <span className="glow-text">Start Your Cyber Journey</span>
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300/78 md:text-base">
                  Explore guided tracks, filter by your level, and move into practical cyber learning without noise or confusion.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <label className="cyber-card group flex min-h-[52px] items-center gap-3 rounded-2xl px-4 transition hover:border-slate-500/50 hover:bg-white/[0.05]">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search tracks and courses..."
                    className="w-full border-0 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </label>

                <div className="flex items-center justify-start md:justify-end">
                  <button
                    type="button"
                    onClick={() => navigate("/program")}
                    className="cyber-btn terminal-font min-h-[52px] rounded-2xl px-5 text-sm"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Open Program
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`terminal-font rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                      activeFilter === filter
                        ? "border border-emerald-300/22 bg-emerald-400/10 text-emerald-100"
                        : "border border-white/8 bg-white/[0.03] text-slate-300 hover:border-slate-500/50 hover:text-white"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-2">
              <div className="cyber-card rounded-[24px] p-4">
                <p className="terminal-font text-[11px] uppercase tracking-[0.2em] text-slate-500">Learning Tracks</p>
                <p className="mt-3 text-2xl font-semibold text-white">{livePaths.length}</p>
                <p className="mt-2 text-sm text-slate-300/72">Structured routes you can search and start quickly.</p>
              </div>
              <div className="cyber-card rounded-[24px] p-4">
                <p className="terminal-font text-[11px] uppercase tracking-[0.2em] text-slate-500">Completed Labs</p>
                <p className="mt-3 text-2xl font-semibold text-white">{stats?.completedLabs || 0} labs</p>
                <p className="mt-2 text-sm text-slate-300/72">Validated learning signals feed your momentum.</p>
              </div>
              <div className="cyber-card rounded-[24px] p-4 sm:col-span-3 xl:col-span-2">
                <p className="terminal-font text-[11px] uppercase tracking-[0.2em] text-slate-400">AI Recommendation</p>
                <p className="mt-3 text-base font-semibold text-white">
                  {highlightedRecommendation?.title || (learningReady ? "The platform will adapt as you complete more labs." : "Syncing your live learning feed...")}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300/76">
                  {highlightedRecommendation?.reason || (learningReady ? "Search a track, enroll, and move straight into guided practice with less friction." : "We are pulling your active learning paths, mission map, and course catalog from the backend.")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section data-reveal className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-400">Learning Tracks</p>
              <h2 className="glow-text mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">Choose the right learning track</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300/76">
                Each track shows what you will learn, how many modules it includes, and where your progress stands right now.
              </p>
            </div>
            <div className="cyber-badge">
              {filteredTracks.length} tracks visible
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {!learningReady ? Array.from({ length: 3 }).map((_, index) => (
              <div key={`track-skeleton-${index}`} className="skeleton-block min-h-[280px] rounded-[28px]" />
            )) : filteredTracks.map((track) => {
              const Icon = track.icon;
              const isEnrolled = track.enrolledProgress > 0;

              return (
                <article
                  key={track.id}
                  data-reveal
                  className="cyber-card group rounded-[28px] p-5 transition duration-200 hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-600/70 bg-slate-900/70 text-sky-200/90">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="cyber-badge">
                      {track.difficulty}
                    </span>
                  </div>

                  <h3 className="mt-5 text-xl font-semibold text-white">{track.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300/76">{track.description}</p>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
                      <p className="terminal-font text-[10px] uppercase tracking-[0.16em] text-slate-500">Modules</p>
                      <p className="mt-2 font-semibold text-white">{track.lessons}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
                      <p className="terminal-font text-[10px] uppercase tracking-[0.16em] text-slate-500">Duration</p>
                      <p className="mt-2 font-semibold text-white">{track.totalHours} hrs</p>
                    </div>
                  </div>

                  {isEnrolled ? (
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-400">
                        <span>Progress</span>
                        <span>{track.enrolledProgress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#34d399,#22d3ee)] transition-all duration-500"
                          style={{ width: `${track.enrolledProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => handleTrackAction(track.id, track.enrolledProgress)}
                    className="cyber-btn terminal-font mt-6 w-full rounded-2xl text-sm"
                  >
                    {isEnrolled ? "Continue" : "Start Track"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section data-reveal className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-400">Featured Courses</p>
              <h2 className="glow-text mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">Featured courses to build momentum fast</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300/76">
                Browse clean course cards, see the category at a glance, and enroll straight into guided learning.
              </p>
            </div>
            <div className="cyber-badge">
              {filteredCourses.length} courses visible
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {!learningReady ? Array.from({ length: 3 }).map((_, index) => (
              <div key={`course-skeleton-${index}`} className="skeleton-block min-h-[360px] rounded-[28px]" />
            )) : filteredCourses.map((course) => (
              <article
                key={course.id}
                data-reveal
                className="cyber-card group overflow-hidden rounded-[28px] transition duration-200 hover:-translate-y-1"
              >
                <div className="relative h-40 border-b border-white/8 bg-[radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(16,185,129,0.14),transparent_22%),linear-gradient(135deg,rgba(8,14,24,1),rgba(6,10,18,1))]">
                  <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.06)_48%,transparent_100%)] opacity-0 transition duration-300 group-hover:opacity-100" />
                  <div className="absolute inset-x-5 bottom-5">
                    <span className="rounded-full border border-slate-600/70 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                      {course.filterDifficulty}
                    </span>
                  </div>
                </div>

                <div className="p-5">
                  <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-slate-400">Course</p>
                  <h3 className="text-xl font-semibold text-white">{course.title}</h3>
                  <p className="mt-3 min-h-[3.25rem] text-sm leading-6 text-slate-300/76">{trimDescription(course.description)}</p>

                  <div className="mt-5 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {course.duration}
                    </span>
                    <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1">{course.lessons} lessons</span>
                    <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1">{course.difficulty}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCourseAction(course.title)}
                    className="cyber-btn terminal-font mt-6 w-full rounded-2xl text-sm"
                  >
                    {course.progress > 0 ? "Continue" : "Enroll"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          data-reveal
          className="cyber-card scanLine overflow-hidden rounded-[32px] p-6 md:p-8"
        >
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-300/70">60-Day Program</p>
              <h2 className="glow-text mt-3 text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">
                A guided 60-day roadmap that turns scattered learning into daily forward motion
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300/78 md:text-base">
                Follow a daily mission path across foundations, appsec, defense, cloud, hunting, and capstone work with one clean next step every day.
              </p>

              <div className="mt-5 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">{Math.max(1, liveMissions.length)} missions</span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">{totalProgramHours} guided hours</span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                  {adaptive?.learning?.next_missions?.[0]?.lesson_title || "Daily unlock flow"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate("/program")}
                className="cyber-btn terminal-font mt-6 rounded-2xl text-sm"
              >
                <ArrowRight className="h-4 w-4" />
                Open 60-Day Program
              </button>
            </div>

            <div className="grid gap-3">
              {(learningReady ? programHighlights : [
                { label: "Live sync", dayRange: "Connecting", mission: "Loading your mission map", challenge: "Preparing the next validated step" },
                { label: "Backend feed", dayRange: "Courses + Paths", mission: "Pulling catalog data", challenge: "Aligning your training timeline" },
                { label: "Program state", dayRange: "Progress-aware", mission: "Matching recommendations", challenge: "Unlocking the right next action" },
              ]).map((item) => (
                <div key={item.label} className="cyber-card rounded-[24px] p-4 transition duration-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300/70">{item.label}</p>
                      <p className="mt-2 text-sm font-semibold text-white">{item.dayRange}</p>
                    </div>
                    <Target className="h-4 w-4 text-sky-200/90" />
                  </div>
                  <p className="mt-3 text-sm text-slate-300/76">
                    Start with <span className="text-white">{item.mission}</span>
                  </p>
                  <p className="mt-2 text-sm text-slate-400">Finish this phase by proving: {item.challenge}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LearnPage;
