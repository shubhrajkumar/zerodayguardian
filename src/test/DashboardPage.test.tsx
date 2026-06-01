import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// ── Mocks ──

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseUserProgress = vi.fn();

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

vi.mock("@/context/UserProgressContext", () => ({
  useUserProgress: () => mockUseUserProgress(),
}));

vi.mock("@/components/AnimatedCyberBackground", () => ({
  default: () => <div data-testid="cyber-background" />,
}));

import DashboardPage from "@/pages/DashboardPage";

// ── Helpers ──

const renderDashboardPage = () => {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DashboardPage />
    </MemoryRouter>
  );
};

const defaultUser = {
  id: "1",
  name: "TestUser",
  email: "test@example.com",
  role: "user",
};

const defaultProgress = {
  xp: 1280,
  rank: "Cyber Sentinel",
  streak: 7,    badges: 12,
    completedLabs: 5,
    totalLabsTouched: 8,
    points: 1280,
    level: 5,
    achievements: ["first_login"],
    totalActions: 42,
  todayActions: 3,
  xpToNextRank: 900,
  nextRank: "Guardian",
  skillGraph: {
    nodes: [],
    strongest: [],
    weakest: [],
    recommendedPath: [],
  },
};

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: defaultUser });
    mockUseUserProgress.mockReturnValue({ progress: defaultProgress });
  });

  // ── Greeting ──

  it("renders 'Good morning' greeting before noon", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 1, 9, 0, 0));
    renderDashboardPage();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("Good morning");
    expect(heading.textContent).toContain("TestUser");
    vi.useRealTimers();
  });

  it("renders 'Good afternoon' greeting at 2pm", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 1, 14, 0, 0));
    renderDashboardPage();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Good afternoon"
    );
    vi.useRealTimers();
  });

  it("renders 'Good evening' greeting after 6pm", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 1, 20, 0, 0));
    renderDashboardPage();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Good evening"
    );
    vi.useRealTimers();
  });

  it("renders fallback 'Guardian' when no user name or email", () => {
    vi.useFakeTimers();
    mockUseAuth.mockReturnValue({ user: null });
    vi.setSystemTime(new Date(2025, 0, 1, 14, 0, 0));
    renderDashboardPage();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Guardian"
    );
    vi.useRealTimers();
  });

  // ── Stats Display ──

  it("renders XP stat", () => {
    renderDashboardPage();
    expect(screen.getByText("XP")).toBeTruthy();
    // The XP value is formatted with locale separators: "1,280"
    expect(screen.getByText("1,280")).toBeTruthy();
  });

  it("renders Streak stat", () => {
    renderDashboardPage();
    expect(screen.getByText("Streak")).toBeTruthy();
    expect(screen.getByText("7 days")).toBeTruthy();
  });

  it("renders Badges stat", () => {
    renderDashboardPage();
    // "Badges" appears in the stats, but also in UserProgressContext types
    // Use getAllByText and check count
    const badgesLabels = screen.getAllByText("Badges");
    expect(badgesLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Rank stat", () => {
    renderDashboardPage();
    const rankElements = screen.getAllByText("Rank");
    expect(rankElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders streak message in welcome section", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 1, 14, 0, 0));
    renderDashboardPage();
    expect(screen.getByText(/7-day streak/)).toBeTruthy();
    vi.useRealTimers();
  });

  // ── Sidebar ──

  it("renders sidebar with navigation items", () => {
    renderDashboardPage();
    // Sidebar items appear in the nav, and some duplicates in quick actions / mobile header
    expect(screen.getAllByText("AI Assistant").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Labs").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Learn").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Community").length).toBeGreaterThanOrEqual(1);
  });

  it("renders brand in sidebar", () => {
    renderDashboardPage();
    const brandElements = screen.getAllByText("ZeroDay");
    expect(brandElements.length).toBeGreaterThanOrEqual(1);
  });

  it("navigates when sidebar item is clicked", async () => {
    renderDashboardPage();
    const items = screen.getAllByText("AI Assistant");
    await userEvent.click(items[0]);
    expect(mockNavigate).toHaveBeenCalledWith("/assistant");
  }, 10000);

  it("renders user info in sidebar footer with avatar initial", () => {
    renderDashboardPage();
    const initials = screen.getAllByText("T");
    expect(initials.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("TestUser").length).toBeGreaterThanOrEqual(1);
  });

  it("renders sidebar avatar initial from email when no displayName", () => {
    mockUseAuth.mockReturnValue({
      user: { ...defaultUser, name: "", email: "hello@example.com" },
    });
    renderDashboardPage();
    const initials = screen.getAllByText("H");
    expect(initials.length).toBeGreaterThanOrEqual(1);
  });

  // ── Quick Actions ──

  it("renders quick action cards", () => {
    renderDashboardPage();
    // Quick actions have their labels; "AI Assistant" also appears in sidebar
    const items = screen.getAllByText("AI Assistant");
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it("renders quick action descriptions", () => {
    renderDashboardPage();
    expect(screen.getByText("Chat with Zorvix AI")).toBeTruthy();
    expect(screen.getByText("Practice in sandbox")).toBeTruthy();
    expect(screen.getByText("Launch security tools")).toBeTruthy();
    expect(screen.getByText("Continue coursework")).toBeTruthy();
  });

  it("navigates when quick action is clicked", async () => {
    renderDashboardPage();
    const runLabButtons = screen.getAllByText("Run Lab");
    await userEvent.click(runLabButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith("/labs");
  }, 10000);

  // ── Recent Activity ──

  it("renders recent activity section", () => {
    renderDashboardPage();
    expect(screen.getByText("Recent Activity")).toBeTruthy();
    expect(screen.getByText("Threat scan completed")).toBeTruthy();
    expect(screen.getByText("Weekly report generated")).toBeTruthy();
    expect(screen.getByText("Lab exercise completed")).toBeTruthy();
  });

  it("renders activity timestamps", () => {
    renderDashboardPage();
    expect(screen.getByText("2 minutes ago")).toBeTruthy();
    expect(screen.getByText("1 hour ago")).toBeTruthy();
    expect(screen.getByText("3 hours ago")).toBeTruthy();
  });

  // ── System Status ──

  it("renders system online badge", () => {
    renderDashboardPage();
    expect(screen.getByText("System Online")).toBeTruthy();
  });

  // ── Animated Background ──

  it("renders animated cyber background", () => {
    renderDashboardPage();
    expect(screen.getByTestId("cyber-background")).toBeTruthy();
  });

  // ── Default Values ──

  it("uses default values when progress is null", () => {
    mockUseUserProgress.mockReturnValue({ progress: null });
    renderDashboardPage();
    // Default values: xp=1280, streak=7, badges=12, rank="Cyber Sentinel"
    expect(screen.getByText("1,280")).toBeTruthy();
    expect(screen.getByText("7 days")).toBeTruthy();
    // "Badges" label exists in stats even with null progress
    expect(screen.getByText("Badges")).toBeTruthy();
    // "Cyber Sentinel" appears in both sidebar and stats
    const sentinelElements = screen.getAllByText("Cyber Sentinel");
    expect(sentinelElements.length).toBeGreaterThanOrEqual(1);
  });

  it("uses default values for missing progress fields", () => {
    mockUseUserProgress.mockReturnValue({
      progress: {
        ...defaultProgress,
        xp: undefined,
        streak: undefined,
        badges: undefined,
        rank: undefined,
      },
    });
    renderDashboardPage();
    // Should fall back to defaults: 1280, 7, 12, "Cyber Sentinel"
    expect(screen.getByText("1,280")).toBeTruthy();
    expect(screen.getByText("7 days")).toBeTruthy();
    expect(screen.getByText("Badges")).toBeTruthy();
    const sentinelElements = screen.getAllByText("Cyber Sentinel");
    expect(sentinelElements.length).toBeGreaterThanOrEqual(1);
  });
});
