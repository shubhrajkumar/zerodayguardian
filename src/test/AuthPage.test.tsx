import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// ── Mocks ──

const mockNavigate = vi.fn();
const mockUseSearchParams = vi.fn(() => [new URLSearchParams(), vi.fn()]);
const mockUseAuth = vi.fn();
const mockLogin = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => mockUseSearchParams(),
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockSignInWithPopup = vi.fn();

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: vi.fn(() => ({
    setCustomParameters: vi.fn(),
  })),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
}));

vi.mock("@/lib/firebase", () => ({
  firebaseAuth: {} as any,
  isFirebaseConfigured: true,
}));

vi.mock("@/lib/api", () => ({
  default: {
    post: vi.fn().mockResolvedValue({
      data: {
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
        user: { id: "g1", name: "Google User", email: "g@test.com", role: "user" },
      },
    }),
  },
}));

import AuthPage from "@/pages/AuthPage";

// ── Helpers ──

const renderAuthPage = () => {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div id="toast-container" data-testid="toast-container" />
      <AuthPage />
    </MemoryRouter>
  );
};

describe("AuthPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue([new URLSearchParams(), vi.fn()]);
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: mockLogin });
  });

  // ── Loading State ──

  it("renders loading spinner when auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, login: mockLogin });
    renderAuthPage();
    expect(document.querySelector(".spinner-cyber")).toBeTruthy();
  });

  // ── Brand Header ──

  it("renders the brand header", () => {
    renderAuthPage();
    expect(screen.getByText("ZeroDay")).toBeTruthy();
    expect(screen.getByText("Guardian")).toBeTruthy();
    expect(screen.getByText("Master Cybersecurity with AI")).toBeTruthy();
  });

  // ── Email/Password + Google Forms ──

  it("renders email/password form and Google button", () => {
    renderAuthPage();
    expect(screen.getByLabelText("Email address")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByText("Continue with Google")).toBeTruthy();
  });

  it("renders Sign In and Sign Up mode toggles", () => {
    renderAuthPage();
    // Both the toggle and submit button show "Sign In" in login mode
    const signInButtons = screen.getAllByText("Sign In");
    expect(signInButtons.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Sign Up")).toBeTruthy();
  });

  it("does NOT render OTP or reset-password elements by default", () => {
    renderAuthPage();
    expect(screen.queryByText("Reset your password")).toBeFalsy();
    expect(screen.queryByText("Send Reset Email")).toBeFalsy();
    expect(screen.queryByText("Verification Code")).toBeFalsy();
  });

  it("redirects to dashboard when user is already authenticated", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "1", name: "Test", email: "test@example.com", role: "user" },
      loading: false,
      login: mockLogin,
    });
    renderAuthPage();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  // ── Mode Toggle ──

  it("toggles between Sign In and Sign Up modes", async () => {
    renderAuthPage();
    // Default is login mode — both toggle and submit show "Sign In"
    const signInButtons = screen.getAllByRole("button", { name: "Sign In" });
    expect(signInButtons.length).toBeGreaterThanOrEqual(2);
    // Click Sign Up toggle
    await userEvent.click(screen.getByText("Sign Up"));
    // Now the submit button should say Create Account
    expect(screen.getByText("Create Account")).toBeTruthy();
    // Name field should appear in signup mode
    expect(screen.getByLabelText("Name")).toBeTruthy();
  });

  // ── Google Login ──

  it("calls Google sign-in when Google button is clicked", async () => {
    mockSignInWithPopup.mockResolvedValue({ user: { uid: "google123", getIdToken: () => Promise.resolve("fake-id-token") } });
    renderAuthPage();
    await userEvent.click(screen.getByText("Continue with Google"));
    await waitFor(() => {
      expect(mockSignInWithPopup).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("shows error when Google popup is closed", async () => {
    mockSignInWithPopup.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    renderAuthPage();
    await userEvent.click(screen.getByText("Continue with Google"));
    await waitFor(() => {
      expect(screen.getByText("Sign-in cancelled")).toBeTruthy();
    });
  });

  it("shows error when Google popup is blocked", async () => {
    mockSignInWithPopup.mockRejectedValue({ code: "auth/popup-blocked" });
    renderAuthPage();
    await userEvent.click(screen.getByText("Continue with Google"));
    await waitFor(() => {
      expect(screen.getByText(/pop-up was blocked/i)).toBeTruthy();
    });
  });

  it("shows generic error for Google login failures", async () => {
    mockSignInWithPopup.mockRejectedValue({ code: "auth/unknown" });
    renderAuthPage();
    await userEvent.click(screen.getByText("Continue with Google"));
    await waitFor(() => {
      expect(screen.getByText("Google sign-in failed. Please try again.")).toBeTruthy();
    });
  });

  it("disables Google button while loading", async () => {
    mockSignInWithPopup.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ user: { uid: "1", getIdToken: () => Promise.resolve("tok") } }), 500))
    );
    renderAuthPage();
    await userEvent.click(screen.getByText("Continue with Google"));
    expect(document.querySelector(".spinner-cyber")).toBeTruthy();
  });

  // ── Error Display ──

  it("displays error in a styled error box", async () => {
    mockSignInWithPopup.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    renderAuthPage();
    await userEvent.click(screen.getByText("Continue with Google"));
    await waitFor(() => {
      const errorBox = screen.getByText("Sign-in cancelled").closest("div");
      expect(errorBox?.className).toContain("red");
    });
  });

  // ── OAuth Error from Search Params ──

  it("displays OAuth error from search params", () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams("error=access_denied"), vi.fn()]);
    renderAuthPage();
    expect(screen.getByText("OAuth error: access_denied")).toBeTruthy();
  });

});
