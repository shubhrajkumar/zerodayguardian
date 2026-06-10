import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// ── Mocks ──

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseUserProgress = vi.fn();
const mockUseGamificationSystem = vi.fn();
const mockLogout = vi.fn();
const mockApiGet = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/context/UserProgressContext", () => ({
  useUserProgress: () => mockUseUserProgress(),
}));

vi.mock("@/lib/gamificationSystem", () => ({
  useGamificationSystem: (...args: unknown[]) => mockUseGamificationSystem(...args),
  getLevelLabel: (level: number) => {
    const labels = ["", "Rookie", "Novice", "Initiate", "Apprentice", "Operative", "Specialist", "Elite", "Expert", "Master", "Legend"];
    return labels[Math.min(level, labels.length - 1)] || `Level ${level}`;
  },
}));

vi.mock("@/lib/api", () => ({
  default: { get: (...args: unknown[]) => mockApiGet(...args) },
}));

vi.mock("@/components/gamification/XPBar", () => ({
  default: ({ snapshot }: { snapshot: { totalXp: number } }) => (
    <div data-testid="xp-bar">XPBar: {snapshot.totalXp}</div>
  ),
}));

vi.mock("@/components/gamification/StreakCounter", () => ({
  default: ({ snapshot }: { snapshot: { streakDays: number } }) => (
    <div data-testid="streak-counter">StreakCounter: {snapshot.streakDays}</div>
  ),
}));

vi.mock("@/components/gamification/BadgeDisplay", () => ({
  default: ({ badges }: { badges: unknown[] }) => (
    <div data-testid="badge-display">BadgeDisplay: {badges.length} badges</div>
  ),
}));

vi.mock("@/components/gamification/LeaderboardCard", () => ({
  default: () => <div data-testid="leaderboard-card">LeaderboardCard</div>,
}));

import ProfilePage from "@/pages/ProfilePage";

// ── Helpers ──

const renderProfile = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ProfilePage />
    </MemoryRouter>
  );

const defaultUser = {
  id: "1",
  name: "TestUser",
  email: "test@example.com",
  role: "user",
};

const defaultSnapshot = {
  totalXp: 2400,
  streakDays: 14,
  level: 6,
  badges: [
    { id: "b1", title: "First Lab", detail: "Completed first lab", icon: "🏆", earnedAt: "2025-01-01" },
    { id: "b2", title: "Week Warrior", detail: "7-day streak", icon: "🔥", earnedAt: "2025-01-02" },
  ],
  recentRewards: [
    { id: "r1", title: "Lab Complete", detail: "Done", xp: 100, tone: "deploy" as const, createdAt: "2025-06-01T10:00:00Z" },
  ],
};

const defaultProgress = {
  xp: 1280,
  rank: "Cyber Sentinel",
  streak: 7,
  completedLabs: 5,
  badges: 12,
};

// ── Tests ──

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: defaultUser, logout: mockLogout });
    mockUseUserProgress.mockReturnValue({ progress: defaultProgress });
    mockUseGamificationSystem.mockReturnValue({
      snapshot: defaultSnapshot,
      loading: false,
    });
    mockApiGet.mockResolvedValue({ data: {} });
    mockLogout.mockResolvedValue(undefined);
  });

  // ── Profile Header ──

  it("renders display name", async () => {
    await renderProfile();
    expect(screen.getByText("TestUser")).toBeTruthy();
  });

  it("renders email", async () => {
    await renderProfile();
    expect(screen.getByText("test@example.com")).toBeTruthy();
  });

  it("renders handle derived from display name", async () => {
    await renderProfile();
    expect(screen.getByText("@testuser")).toBeTruthy();
  });

  it("renders avatar with first letter of display name", async () => {
    await renderProfile();
    // Avatar shows first letter uppercase: "T"
    const avatarEls = screen.getAllByText("T");
    expect(avatarEls.length).toBeGreaterThanOrEqual(1);
  });

  // ── Stats ──

  it("renders XP stat from progress", async () => {
    await renderProfile();
    expect(screen.getByText("XP")).toBeTruthy();
    expect(screen.getByText("1,280")).toBeTruthy();
  });

  it("renders rank stat from progress", async () => {
    await renderProfile();
    expect(screen.getByText("Rank")).toBeTruthy();
    expect(screen.getByText("Cyber Sentinel")).toBeTruthy();
  });

  it("renders labs stat from progress", async () => {
    await renderProfile();
    expect(screen.getByText("Labs")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("renders streak stat from progress", async () => {
    await renderProfile();
    expect(screen.getByText("Streak")).toBeTruthy();
    expect(screen.getByText("7d")).toBeTruthy();
  });

  it("falls back to gamification snapshot when progress is null", async () => {
    mockUseUserProgress.mockReturnValue({ progress: null });
    await renderProfile();
    // snapshot.totalXp=2400, snapshot.streakDays=14
    expect(screen.getByText("2,400")).toBeTruthy();
    expect(screen.getByText("14d")).toBeTruthy();
  });

  // ── Gamification Sections ──

  it("renders XPBar component", async () => {
    await renderProfile();
    expect(screen.getByTestId("xp-bar")).toBeTruthy();
  });

  it("renders StreakCounter component", async () => {
    await renderProfile();
    expect(screen.getByTestId("streak-counter")).toBeTruthy();
  });

  it("renders BadgeDisplay component with badges", async () => {
    await renderProfile();
    expect(screen.getByTestId("badge-display")).toBeTruthy();
    expect(screen.getByText("BadgeDisplay: 2 badges")).toBeTruthy();
  });

  it("renders LeaderboardCard component", async () => {
    await renderProfile();
    expect(screen.getByTestId("leaderboard-card")).toBeTruthy();
  });

  // ── Recent Activity ──

  it("renders recent activity from snapshot rewards", async () => {
    await renderProfile();
    expect(screen.getByText("Recent Activity")).toBeTruthy();
    expect(screen.getByText("Lab Complete")).toBeTruthy();
  });

  it("shows account created when no rewards", async () => {
    mockUseGamificationSystem.mockReturnValue({
      snapshot: { ...defaultSnapshot, recentRewards: [] },
      loading: false,
    });
    await renderProfile();
    expect(screen.getByText("Account created")).toBeTruthy();
  });

  // ── Logout ──

  it("calls logout and navigates to / when logout button is clicked", async () => {
    await renderProfile();
    const logoutButton = screen.getByText("Logout");
    await userEvent.click(logoutButton);
    expect(mockLogout).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  // ── Navigation ──

  it("navigates back when back button is clicked", async () => {
    await renderProfile();
    const backButton = screen.getByText("Back");
    await userEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("navigates to /security when Settings is clicked", async () => {
    await renderProfile();
    const settingsButton = screen.getByText("Settings");
    await userEvent.click(settingsButton);
    expect(mockNavigate).toHaveBeenCalledWith("/security");
  });

  // ── Display Name Fallbacks ──

  it("uses email prefix as display name when name is missing", async () => {
    mockUseAuth.mockReturnValue({
      user: { ...defaultUser, name: "", email: "alice@example.com" },
      logout: mockLogout,
    });
    await renderProfile();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("alice");
  });

  it("uses 'Guardian' when no user at all", async () => {
    mockUseAuth.mockReturnValue({ user: null, logout: mockLogout });
    await renderProfile();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("Guardian");
  });

  // ── Profile API Fetch ──

  it("fetches profile data on mount", async () => {
    await renderProfile();
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/api/users/profile");
    });
  });

  it("uses profile data for display when API returns profile", async () => {
    mockApiGet.mockResolvedValue({
      data: { name: "ApiUser", email: "api@test.com", handle: "apiuser" },
    });
    await renderProfile();
    await waitFor(() => {
      expect(screen.getByText("ApiUser")).toBeTruthy();
      expect(screen.getByText("@apiuser")).toBeTruthy();
    });
  });
});
