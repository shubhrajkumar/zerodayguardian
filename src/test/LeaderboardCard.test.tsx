import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LeaderboardCard from "@/components/gamification/LeaderboardCard";

// ── Mock api ──
const mockGet = vi.fn();
vi.mock("@/lib/api", () => ({ default: { get: (...args: unknown[]) => mockGet(...args) } }));

// ── Helpers ──
const makeRow = (pos: number, alias = `User${pos}`, points = 100 * pos) => ({
  position: pos, alias, rank: "Operative", points, level: pos + 1,
});

const weeklyResponse = { data: { leaderboard: [makeRow(1, "Alice", 500), makeRow(2, "Bob", 400), makeRow(3, "Charlie", 300)] } };
const monthlyResponse = { data: { leaderboard: [makeRow(1, "Dave", 800), makeRow(2, "Eve", 600)] } };
const alltimeResponse = { data: { leaderboard: [makeRow(1, "Frank", 2000), makeRow(2, "Grace", 1500), makeRow(3, "Hank", 1000), makeRow(4, "Ivy", 800), makeRow(5, "Jack", 600)] } };

// ── Tests ──

describe("LeaderboardCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes("period=monthly")) return Promise.resolve(monthlyResponse);
      if (url.includes("period=alltime")) return Promise.resolve(alltimeResponse);
      return Promise.resolve(weeklyResponse);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders header text", async () => {
    await act(async () => { render(<LeaderboardCard />); });
    expect(screen.getByText("Leaderboard")).toBeTruthy();
    expect(screen.getByText("Top 10 Students")).toBeTruthy();
  });

  it("renders period tab buttons", async () => {
    await act(async () => { render(<LeaderboardCard />); });
    expect(screen.getByText("Weekly")).toBeTruthy();
    expect(screen.getByText("Monthly")).toBeTruthy();
    expect(screen.getByText("All-Time")).toBeTruthy();
  });

  it("fetches weekly data on mount (default period)", async () => {
    await act(async () => { render(<LeaderboardCard />); });
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("period=weekly"),
        expect.anything()
      );
    });
  });

  it("fetches monthly data when Monthly tab is clicked", async () => {
    await act(async () => { render(<LeaderboardCard />); });
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    await act(async () => {
      await userEvent.click(screen.getByText("Monthly"));
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("period=monthly"),
        expect.anything()
      );
    });
  });

  it("fetches alltime data when All-Time tab is clicked", async () => {
    await act(async () => { render(<LeaderboardCard />); });
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    await act(async () => {
      await userEvent.click(screen.getByText("All-Time"));
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("period=alltime"),
        expect.anything()
      );
    });
  });

  it("does not re-fetch when clicking the same active tab", async () => {
    await act(async () => { render(<LeaderboardCard />); });
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    await act(async () => {
      await userEvent.click(screen.getByText("Weekly"));
    });

    // Should still be 1 call since clicking the already-active tab is a no-op
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("shows loading spinner while fetching", async () => {
    // Make the API call hang
    mockGet.mockReturnValue(new Promise(() => {}));

    await act(async () => { render(<LeaderboardCard />); });

    expect(screen.getByText("Fetching weekly rankings...")).toBeTruthy();
  });

  it("shows top 3 entries with medal icons", async () => {
    await act(async () => { render(<LeaderboardCard />); });
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeTruthy();
      expect(screen.getByText("Bob")).toBeTruthy();
      expect(screen.getByText("Charlie")).toBeTruthy();
    });
    // Medal icons for top 3
    expect(screen.getByText("🥇")).toBeTruthy();
    expect(screen.getByText("🥈")).toBeTruthy();
    expect(screen.getByText("🥉")).toBeTruthy();
  });

  it("shows rest of leaderboard entries", async () => {
    // Use alltime which has 5 entries
    await act(async () => { render(<LeaderboardCard />); });
    await act(async () => {
      await userEvent.click(screen.getByText("All-Time"));
    });
    await waitFor(() => {
      expect(screen.getByText("Ivy")).toBeTruthy();
      expect(screen.getByText("Jack")).toBeTruthy();
    });
    // Their XP values formatted with locale separator
    expect(screen.getByText("800 XP")).toBeTruthy();
    expect(screen.getByText("600 XP")).toBeTruthy();
  });

  it("shows empty state when no leaderboard data", async () => {
    mockGet.mockResolvedValue({ data: { leaderboard: [] } });
    await act(async () => { render(<LeaderboardCard />); });
    await waitFor(() => {
      expect(screen.getByText("No rankings yet")).toBeTruthy();
      expect(screen.getByText("Complete labs to earn XP and rank up!")).toBeTruthy();
    });
  });

  it("shows empty state when API returns null leaderboard", async () => {
    mockGet.mockResolvedValue({ data: {} });
    await act(async () => { render(<LeaderboardCard />); });
    await waitFor(() => {
      expect(screen.getByText("No rankings yet")).toBeTruthy();
    });
  });

  it("shows empty state on API error", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));
    await act(async () => { render(<LeaderboardCard />); });
    await waitFor(() => {
      expect(screen.getByText("No rankings yet")).toBeTruthy();
    });
  });

  it("switches data when toggling between periods", async () => {
    await act(async () => { render(<LeaderboardCard />); });
    await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());

    await act(async () => {
      await userEvent.click(screen.getByText("Monthly"));
    });
    await waitFor(() => {
      expect(screen.getByText("Dave")).toBeTruthy();
      expect(screen.getByText("Eve")).toBeTruthy();
      expect(screen.queryByText("Alice")).toBeNull();
    });

    await act(async () => {
      await userEvent.click(screen.getByText("All-Time"));
    });
    await waitFor(() => {
      expect(screen.getByText("Frank")).toBeTruthy();
      expect(screen.getByText("Grace")).toBeTruthy();
      expect(screen.queryByText("Dave")).toBeNull();
    });
  });

  it("sorts entries by XP descending", async () => {
    mockGet.mockResolvedValue({
      data: { leaderboard: [makeRow(5, "Last", 100), makeRow(1, "Top", 500), makeRow(3, "Middle", 300)] },
    });
    await act(async () => { render(<LeaderboardCard />); });
    await waitFor(() => {
      expect(screen.getByText("Top")).toBeTruthy();
      expect(screen.getByText("Middle")).toBeTruthy();
      expect(screen.getByText("Last")).toBeTruthy();
    });
    // Top should be 🥇
    expect(screen.getByText("🥇")).toBeTruthy();
    expect(screen.getByText("500 XP")).toBeTruthy();
    expect(screen.getByText("100 XP")).toBeTruthy();
  });

  it("limits display to 10 entries", async () => {
    const manyRows = Array.from({ length: 15 }, (_, i) => makeRow(i + 1, `Player${i + 1}`, (15 - i) * 100));
    mockGet.mockResolvedValue({ data: { leaderboard: manyRows } });
    await act(async () => { render(<LeaderboardCard />); });
    await waitFor(() => {
      expect(screen.getByText("Player1")).toBeTruthy();
      expect(screen.getByText("Player10")).toBeTruthy();
      expect(screen.queryByText("Player11")).toBeNull();
    });
  });

  it("filters entries by search query", async () => {
    mockGet.mockResolvedValue({
      data: { leaderboard: [makeRow(1, "Alice", 500), makeRow(2, "Bob", 400), makeRow(3, "Charlie", 300), makeRow(4, "Alex", 200)] },
    });
    await act(async () => { render(<LeaderboardCard />); });
    await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());

    const searchInput = screen.getByPlaceholderText("Search students");
    await act(async () => {
      await userEvent.type(searchInput, "Ali");
    });

    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.queryByText("Bob")).toBeNull();
    expect(screen.queryByText("Charlie")).toBeNull();
  });
});
