/**
 * RoadmapPage Tests — Covers rendering, auth-aware navigation,
 * localStorage persistence, and CyberRoadmap prop passing.
 *
 * Cyber Rationale: Uses a localStorage polyfill since jsdom in this
 * vitest environment doesn't reliably expose Storage methods on the
 * global localStorage object.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// ── localStorage Polyfill ──
// jsdom exposes a localStorage object but its methods may not be
// callable in certain vitest/jsdom versions. This polyfill guarantees
// a working Storage-like object on globalThis.
const createStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
    removeItem: vi.fn((key: string) => { store.delete(key); }),
    clear: vi.fn(() => { store.clear(); }),
    key: vi.fn((index: number) => [...store.keys()][index] ?? null),
    get length() { return store.size; },
    // Provide iterator for Object.keys compatibility
    keys: () => store.keys(),
  };
};

let mockStorage: ReturnType<typeof createStorage>;

beforeEach(() => {
  mockStorage = createStorage();
  vi.stubGlobal("localStorage", mockStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Mocks ──

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();

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

// Mock SEOManager to reduce rendering complexity
vi.mock("@/components/SEOManager", () => ({
  default: ({ title }: { title: string }) => <div data-testid="seo-manager">{title}</div>,
}));

// Mock CyberRoadmap to isolate RoadmapPage tests from framer-motion + complex child
vi.mock("@/components/Roadmap/CyberRoadmap", () => ({
  default: ({
    currentDay,
    completedDays,
    onDayClick,
    onNotifyMe,
  }: {
    currentDay: number;
    completedDays: Set<number>;
    onDayClick: (day: number) => void;
    onNotifyMe: (email: string, day: number) => void;
  }) => (
    <div data-testid="cyber-roadmap">
      <span data-testid="current-day">{currentDay}</span>
      <span data-testid="completed-count">{completedDays.size}</span>
      <button data-testid="day-click-btn" onClick={() => onDayClick?.(5)}>
        Click Day 5
      </button>
      <button data-testid="notify-btn" onClick={() => onNotifyMe?.("test@example.com", 10)}>
        Notify Day 10
      </button>
    </div>
  ),
}));

import RoadmapPage from "@/pages/RoadmapPage";

// ── Constants ──
const STORAGE_KEY_COMPLETED = "zdg:roadmap:completed";
const STORAGE_KEY_CURRENT = "zdg:roadmap:current";
const NOTIFICATION_KEY = "zdg:roadmap:notifications";

// ── Helpers ──

const renderRoadmapPage = () => {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <RoadmapPage />
    </MemoryRouter>
  );
};

const setLocalStorage = (key: string, value: unknown) => {
  mockStorage.setItem(key, JSON.stringify(value));
};

// ── Tests ──

describe("RoadmapPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.clear();
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
  });

  afterEach(() => {
    mockStorage.clear();
  });

  // ── Rendering ──

  it("renders SEOManager with correct title", () => {
    renderRoadmapPage();
    expect(screen.getByTestId("seo-manager")).toBeTruthy();
    expect(screen.getByText(/60-Day Cyber Roadmap/)).toBeTruthy();
  });

  it("renders CyberRoadmap component", () => {
    renderRoadmapPage();
    expect(screen.getByTestId("cyber-roadmap")).toBeTruthy();
  });

  it("passes currentDay prop as 1 by default", () => {
    renderRoadmapPage();
    expect(screen.getByTestId("current-day").textContent).toBe("1");
  });

  it("passes completedDays as empty set by default", () => {
    renderRoadmapPage();
    expect(screen.getByTestId("completed-count").textContent).toBe("0");
  });

  // ── localStorage persistence ──

  it("loads currentDay from localStorage when set", () => {
    setLocalStorage(STORAGE_KEY_CURRENT, 15);
    renderRoadmapPage();
    expect(screen.getByTestId("current-day").textContent).toBe("15");
  });

  it("loads completedDays from localStorage when set", () => {
    setLocalStorage(STORAGE_KEY_COMPLETED, [1, 2, 3, 5, 10]);
    renderRoadmapPage();
    expect(screen.getByTestId("completed-count").textContent).toBe("5");
  });

  it("defaults currentDay to 1 when localStorage is corrupt", () => {
    mockStorage.setItem(STORAGE_KEY_CURRENT, "not-a-number");
    renderRoadmapPage();
    expect(screen.getByTestId("current-day").textContent).toBe("1");
  });

  it("defaults completedDays to empty set when localStorage is corrupt", () => {
    mockStorage.setItem(STORAGE_KEY_COMPLETED, "not-json");
    renderRoadmapPage();
    expect(screen.getByTestId("completed-count").textContent).toBe("0");
  });

  it("defaults currentDay to 1 when localStorage key is missing", () => {
    renderRoadmapPage();
    expect(screen.getByTestId("current-day").textContent).toBe("1");
  });

  // ── Navigation — Authenticated ──

  it("navigates to /program/day/5 when clicking a day and authenticated", async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    renderRoadmapPage();
    await userEvent.click(screen.getByTestId("day-click-btn"));
    expect(mockNavigate).toHaveBeenCalledWith("/program/day/5");
  });

  it("navigates to /auth when clicking a day and not authenticated", async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    renderRoadmapPage();
    await userEvent.click(screen.getByTestId("day-click-btn"));
    expect(mockNavigate).toHaveBeenCalledWith("/auth");
  });

  // ── Notify Me ──

  it("stores notification request in localStorage", async () => {
    renderRoadmapPage();
    await userEvent.click(screen.getByTestId("notify-btn"));
    const stored = JSON.parse(mockStorage.getItem(NOTIFICATION_KEY) || "[]");
    expect(stored.length).toBe(1);
    expect(stored[0].email).toBe("test@example.com");
    expect(stored[0].day).toBe(10);
    expect(stored[0].timestamp).toBeDefined();
  });

  it("appends to existing notifications in localStorage", async () => {
    setLocalStorage(NOTIFICATION_KEY, [
      { email: "existing@test.com", day: 5, timestamp: "2025-01-01T00:00:00.000Z" },
    ]);

    renderRoadmapPage();

    // Click notify twice
    await userEvent.click(screen.getByTestId("notify-btn"));
    await userEvent.click(screen.getByTestId("notify-btn"));

    const stored = JSON.parse(mockStorage.getItem(NOTIFICATION_KEY) || "[]");
    expect(stored.length).toBe(3); // 1 existing + 2 new
    expect(stored[0].email).toBe("existing@test.com");
    expect(stored[1].email).toBe("test@example.com");
    expect(stored[2].email).toBe("test@example.com");
  });

  it("does not throw when localStorage throws on getItem/setItem", async () => {
    // Replace the mock storage with one that throws
    const throwingStorage = {
      getItem: () => { throw new Error("Storage unavailable"); },
      setItem: () => { throw new Error("Storage unavailable"); },
      removeItem: () => { throw new Error("Storage unavailable"); },
      clear: () => { throw new Error("Storage unavailable"); },
      key: () => null,
      get length() { return 0; },
    };
    vi.stubGlobal("localStorage", throwingStorage);

    // Should render without throwing (component has try/catch guards)
    renderRoadmapPage();
    expect(screen.getByTestId("cyber-roadmap")).toBeTruthy();

    // Click notify should not throw (catch block handles it)
    await userEvent.click(screen.getByTestId("notify-btn"));

    // Restore the mock storage for subsequent tests
    vi.stubGlobal("localStorage", mockStorage);
  });
});
