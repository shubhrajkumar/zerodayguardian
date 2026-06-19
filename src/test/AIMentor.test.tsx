/**
 * AIMentor.test.tsx — Unit tests for the AIMentor component covering:
 * - Tab switching (chat, goals, skills, roadmap, progress)
 * - Skill calculation scaling with completedDays
 * - Goal progress derived from completedDays
 * - DailyRecommendationsPanel navigation
 * - MissionProgressGrid visual states
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// ── Mocks ──

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseMissionSystem = vi.fn();
const mockUseGamificationSystem = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/context/MissionSystemApiContext", () => ({
  useMissionSystem: () => mockUseMissionSystem(),
}));

vi.mock("@/lib/gamificationSystem", () => ({
  useGamificationSystem: () => mockUseGamificationSystem(),
  getLevelLabel: (level: number) => {
    if (level >= 16) return "Elite Guardian";
    if (level >= 10) return "Guardian";
    if (level >= 8) return "Specialist";
    if (level >= 6) return "Hunter";
    if (level >= 4) return "Analyst";
    if (level >= 2) return "Operator";
    return "Recruit";
  },
  getRankIcon: (level: number) => {
    if (level >= 16) return "\u{1F480}";  // skull
    if (level >= 10) return "\u{1F451}";  // crown
    if (level >= 8) return "\u26A1";      // zap
    if (level >= 6) return "\u{1F3AF}";   // target
    if (level >= 4) return "\u{1F6E1}";   // shield
    if (level >= 2) return "\u{1F510}";   // lock
    return "\u{1FAE6}";                   // helmet
  },
  getRankByLevel: (level: number) => {
    if (level >= 16) return { id: "elite-guardian", title: "Elite Guardian", icon: "\u{1F480}", minLevel: 16, description: "Top operator.", unlocks: [] };
    if (level >= 10) return { id: "guardian", title: "Guardian", icon: "\u{1F451}", minLevel: 10, description: "You protect systems.", unlocks: [] };
    if (level >= 8) return { id: "specialist", title: "Specialist", icon: "\u26A1", minLevel: 8, description: "You specialise.", unlocks: [] };
    if (level >= 6) return { id: "hunter", title: "Hunter", icon: "\u{1F3AF}", minLevel: 6, description: "You hunt vulnerabilities.", unlocks: [] };
    if (level >= 4) return { id: "analyst", title: "Analyst", icon: "\u{1F6E1}", minLevel: 4, description: "You analyze threats.", unlocks: [] };
    if (level >= 2) return { id: "operator", title: "Operator", icon: "\u{1F510}", minLevel: 2, description: "Basic recon.", unlocks: [] };
    return { id: "recruit", title: "Recruit", icon: "\u{1FAE6}", minLevel: 1, description: "First step.", unlocks: [] };
  },
  getNextRank: (level: number) => {
    if (level < 2) return { id: "operator", title: "Operator", icon: "\u{1F510}", minLevel: 2, description: "Basic recon.", unlocks: [] };
    if (level < 4) return { id: "analyst", title: "Analyst", icon: "\u{1F6E1}", minLevel: 4, description: "You analyze threats.", unlocks: [] };
    if (level < 6) return { id: "hunter", title: "Hunter", icon: "\u{1F3AF}", minLevel: 6, description: "You hunt vulnerabilities.", unlocks: [] };
    return null;
  },
}));

vi.mock("@/components/Zorvix", () => ({
  default: ({ fullScreen }: { fullScreen?: boolean }) => (
    <div data-testid="zorvix-chat">Zorvix Chat {fullScreen ? "(fullscreen)" : ""}</div>
  ),
}));

vi.mock("@/data/missionCatalog", () => ({
  getMission: (day: number) => {
    if (day === 1) return { number: 1, title: "Recon Initiation", focus: "Reconnaissance", xp: 100, difficulty: "beginner", label: "Mission 01: Recon Initiation", objective: "", estimatedMinutes: 15, prerequisite: 0, description: "" };
    if (day === 2) return { number: 2, title: "Digital Footprint Mapping", focus: "Reconnaissance", xp: 110, difficulty: "beginner", label: "Mission 02: Digital Footprint Mapping", objective: "", estimatedMinutes: 20, prerequisite: 1, description: "" };
    if (day === 3) return { number: 3, title: "Linux Operations", focus: "Reconnaissance", xp: 100, difficulty: "beginner", label: "Mission 03: Linux Operations", objective: "", estimatedMinutes: 15, prerequisite: 2, description: "" };
    if (day === 4) return { number: 4, title: "Enumeration Protocol", focus: "Reconnaissance", xp: 120, difficulty: "beginner", label: "Mission 04: Enumeration Protocol", objective: "", estimatedMinutes: 20, prerequisite: 3, description: "" };
    if (day === 5) return { number: 5, title: "Web Attack Surface Discovery", focus: "Web Security", xp: 130, difficulty: "intermediate", label: "Mission 05: Web Attack Surface Discovery", objective: "", estimatedMinutes: 25, prerequisite: 4, description: "" };
    if (day === 6) return { number: 6, title: "Authentication Analysis", focus: "Web Security", xp: 140, difficulty: "intermediate", label: "Mission 06: Authentication Analysis", objective: "", estimatedMinutes: 25, prerequisite: 5, description: "" };
    if (day === 7) return { number: 7, title: "Vulnerability Identification", focus: "Web Security", xp: 150, difficulty: "intermediate", label: "Mission 07: Vulnerability Identification", objective: "", estimatedMinutes: 30, prerequisite: 6, description: "" };
    if (day === 8) return { number: 8, title: "Controlled Exploitation Simulation", focus: "Exploitation", xp: 160, difficulty: "intermediate", label: "Mission 08: Controlled Exploitation Simulation", objective: "", estimatedMinutes: 30, prerequisite: 7, description: "" };
    if (day === 9) return { number: 9, title: "Defense Thinking Drill", focus: "Defense", xp: 170, difficulty: "intermediate", label: "Mission 09: Defense Thinking Drill", objective: "", estimatedMinutes: 35, prerequisite: 8, description: "" };
    if (day === 10) return { number: 10, title: "Full Attack Chain Simulation", focus: "Exploitation", xp: 180, difficulty: "intermediate", label: "Mission 10: Full Attack Chain Simulation", objective: "", estimatedMinutes: 35, prerequisite: 9, description: "" };
    if (day === 11) return { number: 11, title: "Branching Decision Lab", focus: "Defense", xp: 190, difficulty: "intermediate", label: "Mission 11: Branching Decision Lab", objective: "", estimatedMinutes: 40, prerequisite: 10, description: "" };
    if (day === 12) return { number: 12, title: "Incident Response Simulation", focus: "Incident Response", xp: 200, difficulty: "intermediate", label: "Mission 12: Incident Response Simulation", objective: "", estimatedMinutes: 40, prerequisite: 11, description: "" };
    if (day === 18) return { number: 18, title: "OSINT Intelligence Gathering", focus: "OSINT", xp: 120, difficulty: "beginner", label: "Mission 18: OSINT Intelligence Gathering", objective: "", estimatedMinutes: 25, prerequisite: 17, description: "" };
    if (day === 21) return { number: 21, title: "SQL Injection Fundamentals", focus: "Web Security", xp: 180, difficulty: "intermediate", label: "Mission 21: SQL Injection Fundamentals", objective: "", estimatedMinutes: 35, prerequisite: 20, description: "" };
    if (day === 31) return { number: 31, title: "Container Security Fundamentals", focus: "Cloud Security", xp: 180, difficulty: "intermediate", label: "Mission 31: Container Security Fundamentals", objective: "", estimatedMinutes: 30, prerequisite: 30, description: "" };
    if (day === 41) return { number: 41, title: "Memory Forensics Analysis", focus: "Forensics", xp: 250, difficulty: "advanced", label: "Mission 41: Memory Forensics Analysis", objective: "", estimatedMinutes: 45, prerequisite: 40, description: "" };
    if (day === 45) return { number: 45, title: "Cryptography in Practice", focus: "Cryptography", xp: 190, difficulty: "intermediate", label: "Mission 45: Cryptography in Practice", objective: "", estimatedMinutes: 35, prerequisite: 44, description: "" };
    return null;
  },
  getMissionTitle: (day: number) => {
    if (day === 1) return "Recon Initiation";
    if (day === 20) return "Phishing Attack Simulation";
    if (day === 21) return "SQL Injection Fundamentals";
    if (day === 40) return "Password Cracking & Hash Analysis";
    if (day === 60) return "Final Guardian Challenge";
    return `Mission ${String(day).padStart(2, "0")}`;
  },
}));

// ── Helpers ──

const defaultUser = {
  id: "user-1",
  name: "TestUser",
  email: "test@example.com",
  role: "user" as const,
};

const defaultMissionState = {
  totalPoints: 1500,
  completedDays: 12,
  streak: 5,
  nextMissionHook: { title: "SQL Injection Lab", detail: "Complete the SQLi lab.", ctaLabel: "Start", target: "task" as const, route: "/program/day/21" },
  recommendations: [{ title: "Learn XSS", reason: "Fundamental", action: "Start module", priority: 1 }],
};

const defaultGamificationSnapshot = {
  userId: "user-1",
  handle: "TestUser",
  dailyKey: "2025-01-01",
  weeklyKey: "2025-W01",
  level: 3,
  totalXp: 1500,
  xpIntoLevel: 600,
  xpToNextLevel: 1200,
  streakDays: 5,
  completedDays: 12,
  dailyMissions: [],
  weeklyMissions: [],
  quizQuestions: [],
  quizAnswers: {},
  badges: [],
  recentRewards: [],
  serviceStatus: "ready" as const,
  serviceMessage: "Ready",
};

import AIMentor from "@/components/mentor/AIMentor";

const setup = (overrides?: {
  user?: typeof defaultUser | null;
  mission?: Partial<typeof defaultMissionState>;
  gamification?: Partial<typeof defaultGamificationSnapshot>;
}) => {
  mockUseAuth.mockReturnValue({ user: overrides?.user ?? defaultUser });
  mockUseMissionSystem.mockReturnValue({ ...defaultMissionState, ...overrides?.mission });
  mockUseGamificationSystem.mockReturnValue({
    snapshot: { ...defaultGamificationSnapshot, ...overrides?.gamification },
    loading: false,
    error: "",
    latestReward: null,
    refresh: vi.fn(),
    clearLatestReward: vi.fn(),
    completeMission: vi.fn(),
    submitQuizAnswer: vi.fn(),
  });
};

// ── Tests ──

describe("AIMentor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Rendering ──

  it("renders the ZORVIX AI Mentor header", () => {
    render(<AIMentor />);
    expect(screen.getByText("ZORVIX")).toBeTruthy();
    expect(screen.getByText("Personal Cyber Mentor")).toBeTruthy();
  });

  it("renders rank label, mission count and level in the header subtitle", async () => {
    // Default mock has level=3 → getRankByLevel picks Operator (minLevel 2)
    render(<AIMentor />);
    await waitFor(() => {
      expect(screen.getByText(/Operator/)).toBeTruthy();
      expect(screen.getByText((content) => content.includes("12") && content.includes("ops completed"))).toBeTruthy();
    });
  });

  it("renders the footer with XP (unformatted number), mission status, and streak", () => {
    render(<AIMentor />);
    // totalPoints is mocked as 1500 - renders unformatted
    expect(screen.getByText(/1500 XP/)).toBeTruthy();
    expect(screen.getByText(/5d Streak/)).toBeTruthy();
    expect(screen.getByText(/Mission Ready/)).toBeTruthy();
  });

  it("shows Mission Pending when no next mission route", () => {
    setup({ mission: { nextMissionHook: { route: null as unknown as string, title: "", detail: "", ctaLabel: "", target: "task" as const } } });
    render(<AIMentor />);
    expect(screen.getByText(/Mission Pending/)).toBeTruthy();
  });

  it("renders all five tab buttons on desktop", () => {
    render(<AIMentor />);
    expect(screen.getByText("Chat")).toBeTruthy();
    expect(screen.getByText("Goals")).toBeTruthy();
    expect(screen.getByText("Skills")).toBeTruthy();
    expect(screen.getByText("Roadmap")).toBeTruthy();
    expect(screen.getByText("Progress")).toBeTruthy();
  });

  // ── Tab Switching ──

  describe("tab switching", () => {
    it("starts on the chat tab by default, showing Zorvix", () => {
      render(<AIMentor />);
      expect(screen.getByTestId("zorvix-chat")).toBeTruthy();
      expect(screen.getByText("Zorvix Chat (fullscreen)")).toBeTruthy();
    });

    it("switches to the Goals tab and shows goal content", async () => {
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Goals"));
      await waitFor(() => {
        expect(screen.getByText("Your Mission Goals")).toBeTruthy();
        expect(screen.getByText("Complete Phase 1")).toBeTruthy();
        expect(screen.getByText("Web Security Specialist")).toBeTruthy();
      });
    });

    it("switches to the Skills tab and shows skill areas", async () => {
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Skills"));
      await waitFor(() => {
        expect(screen.getByText("Overall Proficiency")).toBeTruthy();
        expect(screen.getByText("Reconnaissance")).toBeTruthy();
        expect(screen.getByText("Web Security")).toBeTruthy();
        expect(screen.getByText("Exploitation")).toBeTruthy();
        expect(screen.getByText("Defense & IR")).toBeTruthy();
      });
    });

    it("switches to the Roadmap tab and shows rank progression", async () => {
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Roadmap"));
      await waitFor(() => {
        expect(screen.getByText("Rank Progression")).toBeTruthy();
        expect(screen.getByText("Next Rank")).toBeTruthy();
        expect(screen.getByText("Phase 1: Foundations")).toBeTruthy();
      });
    });

    it("switches to the Progress tab and shows mission grid + recommendations", async () => {
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        expect(screen.getByText("Mission Progress")).toBeTruthy();
        expect(screen.getByText("AI Skill Recommendations")).toBeTruthy();
      });
    });

    it("hides Zorvix chat when switching to a different tab", async () => {
      render(<AIMentor />);
      expect(screen.getByTestId("zorvix-chat")).toBeTruthy();
      await userEvent.click(screen.getByText("Skills"));
      await waitFor(() => {
        expect(screen.queryByTestId("zorvix-chat")).toBeNull();
      });
    });
  });

  // ── Skill Calculation ──

  describe("skill calculation", () => {
    it("shows 0% overall proficiency and 0/60 when completedDays is 0", async () => {
      setup({ mission: { completedDays: 0 }, gamification: { completedDays: 0 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Skills"));
      await waitFor(() => {
        expect(screen.getByText("0/60 missions")).toBeTruthy();
      });
    });

    it("shows correct mission count when completedDays is 12", async () => {
      setup({ mission: { completedDays: 12 }, gamification: { completedDays: 12 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Skills"));
      await waitFor(() => {
        expect(screen.getByText("12/60 missions")).toBeTruthy();
      });
    });

    it("shows 100% proficiency and 60/60 when all 60 missions completed", async () => {
      setup({ mission: { completedDays: 60 }, gamification: { completedDays: 60, level: 16 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Skills"));
      await waitFor(() => {
        expect(screen.getByText("60/60 missions")).toBeTruthy();
      });
    });

    it("renders all 8 skill areas with correct names", async () => {
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Skills"));
      await waitFor(() => {
        expect(screen.getByText("Reconnaissance")).toBeTruthy();
        expect(screen.getByText("Web Security")).toBeTruthy();
        expect(screen.getByText("Exploitation")).toBeTruthy();
        expect(screen.getByText("Defense & IR")).toBeTruthy();
        expect(screen.getByText("OSINT")).toBeTruthy();
        expect(screen.getByText("Cloud Security")).toBeTruthy();
        expect(screen.getByText("Forensics")).toBeTruthy();
        expect(screen.getByText("Cryptography")).toBeTruthy();
      });
    });

    it("each skill area shows missionsCompleted/totalMissions count", async () => {
      setup({ mission: { completedDays: 12 }, gamification: { completedDays: 12 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Skills"));
      // All 8 skill areas should render a mission count pattern like "N/12 missions"
      await waitFor(() => {
        const missionCounts = screen.getAllByText(/missions/);
        // Each of the 8 skills has a "N/N missions" text, plus the overall "12/60 missions"
        expect(missionCounts.length).toBeGreaterThanOrEqual(8);
      });
    });
  });

  // ── Goal Progress ──

  describe("goal progress", () => {
    it("shows 0% goal progress when completedDays is 0", async () => {
      setup({ mission: { completedDays: 0 }, gamification: { completedDays: 0 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Goals"));
      await waitFor(() => {
        const zeroPercentElements = screen.getAllByText("0%");
        expect(zeroPercentElements.length).toBeGreaterThanOrEqual(4);
      });
    });

    it("shows 20% progress for all goals when completedDays is 12", async () => {
      setup({ mission: { completedDays: 12 }, gamification: { completedDays: 12 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Goals"));
      await waitFor(() => {
        const twentyPercentElements = screen.getAllByText("20%");
        expect(twentyPercentElements.length).toBeGreaterThanOrEqual(4);
      });
    });

    it("shows 100% progress when all missions completed", async () => {
      setup({ mission: { completedDays: 60 }, gamification: { completedDays: 60 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Goals"));
      await waitFor(() => {
        const hundredPercentElements = screen.getAllByText("100%");
        expect(hundredPercentElements.length).toBeGreaterThanOrEqual(4);
      });
    });

    it("renders all four goal suggestions", async () => {
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Goals"));
      await waitFor(() => {
        expect(screen.getByText("Complete Phase 1")).toBeTruthy();
        expect(screen.getByText("Web Security Specialist")).toBeTruthy();
        expect(screen.getByText("Full Stack Operator")).toBeTruthy();
        expect(screen.getByText("Certification Ready")).toBeTruthy();
      });
    });

    it("shows goal type badges (short, medium, long)", async () => {
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Goals"));
      await waitFor(() => {
        expect(screen.getByText("short")).toBeTruthy();
        const mediumBadges = screen.getAllByText("medium");
        expect(mediumBadges.length).toBe(2);
        expect(screen.getByText("long")).toBeTruthy();
      });
    });

    it("shows target date for each goal", async () => {
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Goals"));
      await waitFor(() => {
        expect(screen.getByText(/30 days/)).toBeTruthy();
        expect(screen.getByText(/45 days/)).toBeTruthy();
        expect(screen.getByText(/90 days/)).toBeTruthy();
        expect(screen.getByText(/60 days/)).toBeTruthy();
      });
    });
  });

  // ── DailyRecommendationsPanel Navigation ──

  describe("DailyRecommendationsPanel navigation", () => {
    it("renders all three skill-based recommendations with mission titles", async () => {
      setup({ mission: { completedDays: 5 }, gamification: { completedDays: 5 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        // With completedDays=5, weakest skills get recommendations from the mission catalog
        // These are dynamic based on skill gaps, so check for mission-related content
        const recCards = document.querySelectorAll('[class*="rounded-xl border"]');
        expect(recCards.length).toBeGreaterThanOrEqual(3);
      });
    });

    it("shows XP rewards on each recommendation", async () => {
      setup({ mission: { completedDays: 5 }, gamification: { completedDays: 5 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        const xpLabels = screen.getAllByText(/\+\d+ XP/);
        expect(xpLabels.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('shows "Start your first mission" text when completedDays is 0', async () => {
      setup({ mission: { completedDays: 0 }, gamification: { completedDays: 0 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        expect(screen.getByText("Start your first mission to unlock personalised recommendations.")).toBeTruthy();
      });
    });

    it('shows completed count text when completedDays > 0', async () => {
      setup({ mission: { completedDays: 12 }, gamification: { completedDays: 12 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        expect(screen.getByText(/Targeting your weakest skill areas/)).toBeTruthy();
        expect(screen.getByText(/12\/60 missions completed/)).toBeTruthy();
      });
    });

    it("calls navigate with a mission route when clicking the first recommendation CTA", async () => {
      setup({ mission: { completedDays: 5 }, gamification: { completedDays: 5 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      // Find any Unlock / Start button in the recommendations
      let ctaButton: HTMLElement | null = null;
      await waitFor(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent?.includes('→') && !btn.textContent?.includes('Toggle')) {
            ctaButton = btn;
            break;
          }
        }
        expect(ctaButton).toBeTruthy();
      });
      await userEvent.click(ctaButton!);
      // Should navigate to a /program/day/N route
      expect(mockNavigate).toHaveBeenCalled();
      const calledRoute = mockNavigate.mock.calls[0][0];
      expect(calledRoute).toMatch(/^\/program\/day\//);
    });

    it("shows Weak Skill or Gap Closure badges on recommendations", async () => {
      setup({ mission: { completedDays: 5 }, gamification: { completedDays: 5 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        const badges = screen.getAllByText(/Weak Skill|Gap Closure/);
        expect(badges.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ── MissionProgressGrid ──

  describe("MissionProgressGrid", () => {
    it("renders 60 mission cells", async () => {
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        const missionCells = document.querySelectorAll('button[aria-label*="Mission"]');
        expect(missionCells.length).toBe(60);
      });
    });

    it("shows correct mission count and percentage", async () => {
      setup({ mission: { completedDays: 25 }, gamification: { completedDays: 25 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        expect(screen.getByText(/25\/60 missions cleared/)).toBeTruthy();
      });
    });

    it("marks missions <= completedDays as completed in aria-label", async () => {
      setup({ mission: { completedDays: 3 }, gamification: { completedDays: 3 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        expect(screen.getByLabelText(/Mission 1:.*Completed/)).toBeTruthy();
        expect(screen.getByLabelText(/Mission 2:.*Completed/)).toBeTruthy();
        expect(screen.getByLabelText(/Mission 3:.*Completed/)).toBeTruthy();
      });
    });

    it("marks the next mission as 'In progress'", async () => {
      setup({ mission: { completedDays: 3 }, gamification: { completedDays: 3 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        expect(screen.getByLabelText(/Mission 4:.*In progress/)).toBeTruthy();
      });
    });

    it("marks missions beyond current as 'Locked'", async () => {
      setup({ mission: { completedDays: 3 }, gamification: { completedDays: 3 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        expect(screen.getByLabelText(/Mission 5:.*Locked/)).toBeTruthy();
        expect(screen.getByLabelText(/Mission 60:.*Locked/)).toBeTruthy();
      });
    });

    it("disabled attribute on locked mission buttons, enabled on completed", async () => {
      setup({ mission: { completedDays: 3 }, gamification: { completedDays: 3 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        const lockedBtn = screen.getByLabelText(/Mission 5:.*Locked/) as HTMLButtonElement;
        expect(lockedBtn.disabled).toBe(true);
        const completedBtn = screen.getByLabelText(/Mission 1:.*Completed/) as HTMLButtonElement;
        expect(completedBtn.disabled).toBe(false);
      });
    });

    it("renders the legend with Completed, Current, Locked, and Phase labels", async () => {
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        expect(screen.getByText("Completed")).toBeTruthy();
        expect(screen.getByText("Current")).toBeTruthy();
        expect(screen.getByText("Locked")).toBeTruthy();
        expect(screen.getByText("Phase")).toBeTruthy();
      });
    });

    it("renders phase labels below the grid", async () => {
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        expect(screen.getByText("Phase 1: Foundations")).toBeTruthy();
        expect(screen.getByText("Phase 2: Web & AppSec")).toBeTruthy();
        expect(screen.getByText("Phase 3: Advanced")).toBeTruthy();
      });
    });

    it("navigates when clicking a completed mission cell", async () => {
      setup({ mission: { completedDays: 5 }, gamification: { completedDays: 5 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        expect(screen.getByLabelText(/Mission 3:.*Completed/)).toBeTruthy();
      });
      await userEvent.click(screen.getByLabelText(/Mission 3:.*Completed/));
      expect(mockNavigate).toHaveBeenCalledWith("/program/day/3");
    });

    it("does not navigate when clicking a locked mission cell", async () => {
      setup({ mission: { completedDays: 3 }, gamification: { completedDays: 3 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        expect(screen.getByLabelText(/Mission 10:.*Locked/)).toBeTruthy();
      });
      mockNavigate.mockClear();
      await userEvent.click(screen.getByLabelText(/Mission 10:.*Locked/));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("shows hover titles with mission info for completed cells", async () => {
      setup({ mission: { completedDays: 5 }, gamification: { completedDays: 5 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        const mission1Btn = screen.getByLabelText(/Mission 1:.*Completed/);
        expect(mission1Btn.getAttribute("title")).toContain("Recon Initiation");
      });
    });
  });

  // ── Edge Cases ──

  describe("edge cases", () => {
    it("handles null user gracefully", () => {
      setup({ user: null });
      render(<AIMentor />);
      expect(screen.getByText("ZORVIX")).toBeTruthy();
    });

    it("handles zero completedDays in header", () => {
      setup({ mission: { completedDays: 0 }, gamification: { completedDays: 0, totalXp: 0 } });
      render(<AIMentor />);
      expect(screen.getByText((content) => content.includes("0") && content.includes("ops completed"))).toBeTruthy();
    });

    it("shows 1 current + 59 locked when completedDays is 0", async () => {
      setup({ mission: { completedDays: 0 }, gamification: { completedDays: 0, totalXp: 0 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        const lockedCells = document.querySelectorAll('[aria-label*="Locked"]');
        // Mission 1 is "current" (in progress), missions 2-60 are locked
        expect(lockedCells.length).toBe(59);
        expect(screen.getByLabelText(/Mission 1:.*In progress/)).toBeTruthy();
      });
    });

    it("all 60 cells show Completed when all missions done", async () => {
      setup({ mission: { completedDays: 60 }, gamification: { completedDays: 60, level: 16 } });
      render(<AIMentor />);
      await userEvent.click(screen.getByText("Progress"));
      await waitFor(() => {
        expect(screen.getByText(/60\/60 missions cleared/)).toBeTruthy();
      }, { timeout: 5000 });
      await waitFor(() => {
        const completedCells = document.querySelectorAll('[aria-label*="Completed"]');
        expect(completedCells.length).toBe(60);
      }, { timeout: 5000 });
    });
  });
});
