import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// AuthContext must probe the non-401 session endpoint and do it once per app
// load — repeated probes against /me (401 for anonymous) used to cascade into
// extra /refresh calls and blow the 120 req/15min session rate limit.

const getSpy = vi.fn();
const postSpy = vi.fn();
const clearAuthStateSpy = vi.fn();

vi.mock("@/lib/firebase", () => ({
  initFirebase: vi.fn(async () => {}),
  firebaseAuth: null,
}));

vi.mock("@/lib/apiClient", () => ({
  clearAuthState: (...args: unknown[]) => clearAuthStateSpy(...args),
}));

vi.mock("@/lib/api", () => ({
  default: {
    get: (...args: unknown[]) => getSpy(...args),
    post: (...args: unknown[]) => postSpy(...args),
  },
}));

const ANON_RESPONSE = { data: { status: "ok", authenticated: false, user: null } };

const mountProvider = async () => {
  const mod = await import("@/context/AuthContext");

  const Consumer = () => {
    const { authState, user } = mod.useAuth();
    return (
      <div>
        <span data-testid="state">{authState}</span>
        <span data-testid="email">{user?.email || "none"}</span>
      </div>
    );
  };

  const App = () => (
    <mod.AuthProvider>
      <Consumer />
    </mod.AuthProvider>
  );

  const utils = render(<App />);
  return { ...utils, App };
};

// Paths requested for the session-check bucket.
const sessionPaths = () =>
  [
    ...getSpy.mock.calls.map((c) => String(c[0])),
    ...postSpy.mock.calls.map((c) => String(c[0])),
  ].filter((url) => url.startsWith("/api/auth/"));

beforeEach(() => {
  vi.resetModules(); // fresh module-level probe/backoff state per test
  getSpy.mockReset();
  postSpy.mockReset();
  clearAuthStateSpy.mockReset();
});

describe("AuthContext session probing", () => {
  it("probes /api/auth/status, never the 401-returning /api/auth/me", async () => {
    getSpy.mockResolvedValue(ANON_RESPONSE);

    await mountProvider();

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("unauthenticated"));

    expect(getSpy).toHaveBeenCalledWith("/api/auth/status", expect.anything());
    expect(sessionPaths()).not.toContain("/api/auth/me");
  });

  it("restores an authenticated session from the probe without calling /refresh", async () => {
    getSpy.mockResolvedValue({
      data: {
        status: "ok",
        authenticated: true,
        user: { id: "u1", name: "Ada", email: "ada@example.com", role: "admin" },
      },
    });

    await mountProvider();

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("authenticated"));
    expect(screen.getByTestId("email").textContent).toBe("ada@example.com");
    // A healthy session must cost exactly one request.
    expect(postSpy).not.toHaveBeenCalled();
    expect(sessionPaths()).toEqual(["/api/auth/status"]);
  });

  it("does not re-probe when the provider re-renders", async () => {
    getSpy.mockResolvedValue(ANON_RESPONSE);

    const { App, rerender } = await mountProvider();

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("unauthenticated"));
    const callsAfterMount = getSpy.mock.calls.length;

    rerender(<App />);
    rerender(<App />);

    // Re-rendering must not trigger additional session-bucket traffic.
    expect(getSpy.mock.calls.length).toBe(callsAfterMount);
  });

  it("keeps a single anonymous load within a small, bounded request budget", async () => {
    // Anonymous: probe (200, no session) then one refresh attempt, then re-probe.
    getSpy.mockResolvedValue(ANON_RESPONSE);
    postSpy.mockRejectedValue(new Error("401"));

    await mountProvider();

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("unauthenticated"));

    // Previously this path cost ~5 requests (nested interceptor refreshes).
    expect(sessionPaths().length).toBeLessThanOrEqual(3);
  });
});
