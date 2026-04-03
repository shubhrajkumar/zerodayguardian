import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, Radar, ShieldCheck, TerminalSquare } from "lucide-react";
import { Link } from "react-router-dom";
import PlatformHero from "@/components/platform/PlatformHero";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { pyGetJson } from "@/lib/pyApiClient";
import { useAuth } from "@/context/AuthContext";

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

type LiveResourceEntry = {
  id: string;
  category: string;
  title: string;
  format: string;
  useCase: string;
  whyHighValue: string;
  linkLabel: string;
  url: string;
  track: string;
};

const ResourcesPage = () => {
  const { authState, isAuthenticated } = useAuth();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [paths, setPaths] = useState<LearningPathItem[]>([]);
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  const resourceLibrary = useMemo<LiveResourceEntry[]>(() => {
    const courseEntries = courses.map((course, index) => ({
      id: `course-${course.id}`,
      category: "Guided Courses",
      title: course.title,
      format: `${course.difficulty || "Guided"} course`,
      useCase: course.description || "Build a guided skill foundation with a structured course path.",
      whyHighValue: course.progress > 0
        ? `You already have ${course.progress}% progress here, so continuing this course compounds real momentum instead of starting over.`
        : "Course progress syncs against your live training data, so you can resume without losing context.",
      linkLabel: index === 0 ? "Open learning track" : "Resume course",
      url: "/learn",
      track: course.difficulty || "general",
    }));

    const pathEntries = paths.map((path) => ({
      id: `path-${path.id}`,
      category: "Learning Paths",
      title: path.title,
      format: `${path.difficulty || "Adaptive"} path`,
      useCase: path.description || "Follow a backend-synced learning path that maps directly to your practical journey.",
      whyHighValue: `This ${path.track || "security"} path is versioned in the live backend, so the content reflects the active curriculum instead of a frozen template.`,
      linkLabel: "View path",
      url: "/learn",
      track: path.track || "general",
    }));

    const missionEntries = missions.slice(0, 12).map((mission) => ({
      id: `mission-${mission.id}`,
      category: "Program Missions",
      title: mission.title,
      format: `${mission.lesson_type || "guided"} mission`,
      useCase: `Use this mission inside ${mission.module_title} to translate theory into a validated program step.`,
      whyHighValue: `Missions are pulled from the active program graph for ${mission.path_title}, so your resource feed stays aligned with actual unlockable work.`,
      linkLabel: "Open program mission",
      url: "/program",
      track: mission.path_title || "program",
    }));

    return [...pathEntries, ...courseEntries, ...missionEntries];
  }, [courses, missions, paths]);

  useScrollReveal([resourceLibrary.length, loading, ready]);

  useEffect(() => {
    if (authState === "loading") return;

    if (!isAuthenticated) {
      setCourses([]);
      setPaths([]);
      setMissions([]);
      setLoading(false);
      setReady(true);
      return;
    }

    let active = true;

    const load = async () => {
      setLoading(true);
      const [coursesResult, pathsResult, missionsResult] = await Promise.allSettled([
        pyGetJson<CoursesResponse>("/courses"),
        pyGetJson<LearningPathItem[]>("/learning/paths"),
        pyGetJson<MissionItem[]>("/missions"),
      ]);

      if (!active) return;

      setCourses(coursesResult.status === "fulfilled" && Array.isArray(coursesResult.value.courses) ? coursesResult.value.courses : []);
      setPaths(pathsResult.status === "fulfilled" && Array.isArray(pathsResult.value) ? pathsResult.value : []);
      setMissions(missionsResult.status === "fulfilled" && Array.isArray(missionsResult.value) ? missionsResult.value : []);
      setLoading(false);
      setReady(true);
    };

    load().catch(() => {
      if (!active) return;
      setCourses([]);
      setPaths([]);
      setMissions([]);
      setLoading(false);
      setReady(true);
    });

    return () => {
      active = false;
    };
  }, [authState, isAuthenticated]);

  const groupedResources = useMemo(() => {
    return resourceLibrary.reduce<Record<string, LiveResourceEntry[]>>((accumulator, resource) => {
      const key = resource.category;
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(resource);
      return accumulator;
    }, {});
  }, [resourceLibrary]);

  return (
    <div className="container mx-auto px-4 py-12 page-shell">
      <div className="mx-auto max-w-7xl">
        <PlatformHero
          eyebrow="Practical Resources"
          title={
            <>
              Live references for <span className="brand-gradient-text-animated">actual workflow decisions</span>
            </>
          }
          description="This resource layer now derives from the live backend catalog: active learning paths, synced courses, and program missions that push you back into practice quickly."
          pills={[
            `${resourceLibrary.length} live entries`,
            isAuthenticated ? "Synced to account" : "Sign in to sync",
            "Program-linked",
            "Practice-ready",
          ]}
          aside={
            <div className="space-y-3 text-sm text-slate-200">
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/62">Resource standard</p>
              <p>Every entry should answer what it is for, why it matters, and where to practice the skill next.</p>
              <p className="text-cyan-100/70">The goal is faster operator judgment, not a long bookmark list.</p>
            </div>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="glass-card rounded-[28px] p-6">
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">High-value collection</p>
            <h2 className="mt-2 text-2xl font-black text-white">Curated by live workflow state</h2>
            <div className="mt-5 grid gap-5">
              {loading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={`resource-skeleton-${index}`} className="skeleton-block min-h-[220px] rounded-2xl" />
                ))
              ) : !isAuthenticated ? (
                <div className="rounded-2xl border border-cyan-300/12 bg-black/20 p-5">
                  <p className="text-sm font-semibold text-white">Sign in to unlock your live resource library</p>
                  <p className="mt-2 text-sm text-slate-300/82">
                    Resources now come from your real course, learning-path, and mission feeds, so we wait for an authenticated session before syncing them.
                  </p>
                  <Link to="/auth" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100">
                    Open sign in
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : Object.entries(groupedResources).length ? (
                Object.entries(groupedResources).map(([category, items]) => (
                  <div key={category} className="rounded-2xl border border-cyan-300/12 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/60">{category}</p>
                        <h3 className="mt-2 text-lg font-bold text-white">{items.length} operator-ready resource{items.length === 1 ? "" : "s"}</h3>
                      </div>
                      <span className="rounded-full border border-cyan-300/16 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-cyan-100/72">
                        Live library
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4">
                      {items.map((resource) => (
                        <Link
                          key={resource.id}
                          to={resource.url}
                          className="rounded-2xl border border-cyan-300/16 bg-black/25 p-5 transition hover:border-cyan-300/30 hover:bg-cyan-500/10"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/60">{resource.track}</p>
                              <h4 className="mt-2 text-xl font-bold text-white">{resource.title}</h4>
                            </div>
                            <span className="rounded-full border border-cyan-300/16 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-cyan-100/72">
                              {resource.format}
                            </span>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-cyan-300/10 bg-white/[0.03] p-3">
                              <p className="text-xs text-cyan-100/55">Use case</p>
                              <p className="mt-2 text-sm text-slate-300/82">{resource.useCase}</p>
                            </div>
                            <div className="rounded-xl border border-cyan-300/10 bg-white/[0.03] p-3">
                              <p className="text-xs text-cyan-100/55">Why this matters</p>
                              <p className="mt-2 text-sm text-slate-300/82">{resource.whyHighValue}</p>
                            </div>
                          </div>
                          <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100">
                            {resource.linkLabel}
                            <ArrowUpRight className="h-4 w-4" />
                          </p>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))
              ) : ready ? (
                <div className="rounded-2xl border border-cyan-300/12 bg-black/20 p-5">
                  <p className="text-sm font-semibold text-white">No live resources synced yet</p>
                  <p className="mt-2 text-sm text-slate-300/82">
                    Your backend is reachable, but it has not returned active paths, courses, or missions for this account yet.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="glass-card rounded-[28px] p-6">
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">How to use this library</p>
            <h2 className="mt-2 text-2xl font-black text-white">A tighter operator loop</h2>

            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl border border-cyan-300/16 bg-black/25 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-50">
                  <Radar className="h-4 w-4 text-cyan-300" />
                  1. Pick the workflow
                </p>
                <p className="mt-2 text-sm text-slate-300/82">Start with the active task you are actually doing: course continuation, path progression, or the next validated program mission.</p>
              </div>

              <div className="rounded-2xl border border-cyan-300/16 bg-black/25 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-50">
                  <BookOpen className="h-4 w-4 text-cyan-300" />
                  2. Read for action
                </p>
                <p className="mt-2 text-sm text-slate-300/82">Use the live entry to clarify what evidence, concept, or decision you need next. Skip broad reading that does not change the next move.</p>
              </div>

              <div className="rounded-2xl border border-cyan-300/16 bg-black/25 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-50">
                  <TerminalSquare className="h-4 w-4 text-cyan-300" />
                  3. Move into practice
                </p>
                <p className="mt-2 text-sm text-slate-300/82">Jump straight into Learn or the Program so the concept is anchored to terminal work, validation, and progression state.</p>
              </div>

              <div className="rounded-2xl border border-cyan-300/16 bg-black/25 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-50">
                  <ShieldCheck className="h-4 w-4 text-cyan-300" />
                  4. Close the loop
                </p>
                <p className="mt-2 text-sm text-slate-300/82">Return to Dashboard to review streak, progress, and what skill should be reinforced next.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ResourcesPage;
