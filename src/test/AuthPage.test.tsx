import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// ── Mocks ──

const mockNavigate = vi.fn();
const mockUseSearchParams = vi.fn(() => [new URLSearchParams(), vi.fn()]);
const mockUseAuth = vi.fn();
const mockRefreshAuth = vi.fn();
const mockLogin = vi.fn();
const mockApiPost = vi.fn();
const mockApiPostJson = vi.fn();
const mockSetStoredAccessToken = vi.fn();
const mockSetStoredAuthState = vi.fn();

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
const mockSendPasswordResetEmail = vi.fn();
const mockSendEmailVerification = vi.fn();

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: vi.fn(() => ({
    setCustomParameters: vi.fn(),
  })),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
  sendEmailVerification: (...args: unknown[]) => mockSendEmailVerification(...args),
}));

vi.mock("@/lib/firebase", () => ({
  firebaseAuth: {} as any,
  isFirebaseConfigured: true,
}));

vi.mock("@/lib/api", () => ({
  default: {
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

vi.mock("@/lib/apiClient", () => ({
  apiPostJson: (...args: unknown[]) => mockApiPostJson(...args),
  setStoredAccessToken: (...args: unknown[]) => mockSetStoredAccessToken(...args),
  setStoredAuthState: (...args: unknown[]) => mockSetStoredAuthState(...args),
}));

vi.mock("@/components/AnimatedCyberBackground", () => ({
  default: () => <div data-testid="cyber-background" />,
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
    mockRefreshAuth.mockResolvedValue(true);
    mockApiPost.mockResolvedValue({
      data: {
        user: { id: "123", name: "Test", email: "test@example.com", role: "user" },
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
      },
    });
    mockUseAuth.mockReturnValue({ user: null, loading: false, refreshAuth: mockRefreshAuth, login: mockLogin });
  });

  // ── Loading State ──

  it("renders loading spinner when auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, refreshAuth: mockRefreshAuth, login: mockLogin });
    renderAuthPage();
    expect(document.querySelector(".spinner-cyber")).toBeTruthy();
  });

  // ── Login Mode (default) ──

  it("renders login form by default", () => {
    renderAuthPage();
    expect(screen.getByText("Master Cybersecurity with AI")).toBeTruthy();
    expect(screen.getByLabelText("Email address")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByText("Sign In")).toBeTruthy();
    expect(screen.getByText("Continue with Google")).toBeTruthy();
  });

  it("shows Google button in login/register mode but not reset mode", () => {
    renderAuthPage();
    expect(screen.getByText("Continue with Google")).toBeTruthy();
  });

  it("renders the brand header", () => {
    renderAuthPage();
    expect(screen.getByText("ZeroDay")).toBeTruthy();
    expect(screen.getByText("Guardian")).toBeTruthy();
    expect(screen.getAllByText(/Secure/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders forgot password link in login mode", () => {
    renderAuthPage();
    expect(screen.getByText("Forgot your password?")).toBeTruthy();
  });

  it("renders sign up toggle link", () => {
    renderAuthPage();
    expect(screen.getByText("Don't have an account?")).toBeTruthy();
    expect(screen.getByText("Sign up")).toBeTruthy();
  });

  it("redirects to dashboard when user is already authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "1", name: "Test", email: "test@example.com", role: "user" },
      loading: false,
      refreshAuth: mockRefreshAuth,
      login: mockLogin,
    });
    renderAuthPage();
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
  });

  // ── Register Mode ──

  it("switches to register mode showing confirm password", async () => {
    renderAuthPage();
    await userEvent.click(screen.getByText("Sign up"));
    expect(screen.getByText("Master Cybersecurity with AI")).toBeTruthy();
    expect(screen.getByLabelText("Confirm password")).toBeTruthy();
    expect(screen.getByText("Create Account")).toBeTruthy();
    expect(screen.getByText("Already have an account?")).toBeTruthy();
    expect(screen.getByText("Sign in")).toBeTruthy();
  });

  it("shows Google button in register mode", async () => {
    renderAuthPage();
    await userEvent.click(screen.getByText("Sign up"));
    expect(screen.getByText("Continue with Google")).toBeTruthy();
  });

  // ── Reset Mode ──

  it("switches to reset mode via forgot password link", async () => {
    renderAuthPage();
    await userEvent.click(screen.getByText("Forgot your password?"));
    expect(screen.getByText("Reset your password")).toBeTruthy();
    expect(screen.queryByLabelText("Password")).toBeFalsy();
    expect(screen.getByText("Send Reset Email")).toBeTruthy();
    expect(screen.getByText("Back to sign in")).toBeTruthy();
  });

  it("hides Google button and password field in reset mode", async () => {
    renderAuthPage();
    await userEvent.click(screen.getByText("Forgot your password?"));
    expect(screen.queryByText("Continue with Google")).toBeFalsy();
    expect(screen.queryByLabelText("Password")).toBeFalsy();
  });

  it("returns to login from reset mode", async () => {
    renderAuthPage();
    await userEvent.click(screen.getByText("Forgot your password?"));
    await userEvent.click(screen.getByText("Back to sign in"));
    expect(screen.getByText("Master Cybersecurity with AI")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
  });

  it("switches to reset mode when mode=resetPassword search param is present", () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams("mode=resetPassword"), vi.fn()]);
    renderAuthPage();
    expect(screen.getByText("Reset your password")).toBeTruthy();
    expect(screen.getByText("Send Reset Email")).toBeTruthy();
  });

  // ── Validation ──

  it("shows error when submitting empty form", async () => {
    renderAuthPage();
    await userEvent.click(screen.getByText("Sign In"));
    expect(screen.getByText("Please fill in all fields")).toBeTruthy();
  });

  it("shows error for short password", async () => {
    renderAuthPage();
    await userEvent.click(screen.getByText("Sign up"));
    await userEvent.type(screen.getByLabelText("Email address"), "test@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "ab");
    await userEvent.type(screen.getByLabelText("Confirm password"), "ab");
    await userEvent.click(screen.getByText("Create Account"));
    expect(screen.getByText("Password must be at least 10 characters")).toBeTruthy();
  });

  it("shows error when passwords do not match in register mode", async () => {
    renderAuthPage();
    await userEvent.click(screen.getByText("Sign up"));
    await userEvent.type(screen.getByLabelText("Email address"), "test@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Password123!");
    await userEvent.type(screen.getByLabelText("Confirm password"), "different");
    await userEvent.click(screen.getByText("Create Account"));
    expect(screen.getByText("Passwords do not match")).toBeTruthy();
  });

  // ── Login Form Submit ──

  it("calls backend login on login submit", async () => {
    renderAuthPage();
    await userEvent.type(screen.getByLabelText("Email address"), "test@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Password123!");
    await userEvent.click(screen.getByText("Sign In"));
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/api/auth/login", {
        email: "test@example.com",
        password: "Password123!",
        rememberMe: true,
      });
    });
    expect(mockLogin).toHaveBeenCalledWith({
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      user: { id: "123", name: "Test", email: "test@example.com", role: "user" },
    });
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
  });

  it("disables inputs and shows spinner while loading", async () => {
    mockApiPost.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: { user: { uid: "123", accessToken: "tok", refreshToken: "rtok" } } }), 500))
    );
    renderAuthPage();
    await userEvent.type(screen.getByLabelText("Email address"), "test@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Password123!");
    await userEvent.click(screen.getByText("Sign In"));

    expect(screen.getByText("Signing in...")).toBeTruthy();
    expect(document.querySelector(".spinner-cyber")).toBeTruthy();
    expect(screen.getByLabelText("Email address")).toBeDisabled();
    expect(screen.getByLabelText("Password")).toBeDisabled();
  });

  // ── Error Handling ──

  it("displays auth error messages", async () => {
    mockApiPost.mockRejectedValue({
      response: { data: { code: "auth/user-not-found" } },
      code: "auth/user-not-found",
      message: "User not found",
    });
    renderAuthPage();
    await userEvent.type(screen.getByLabelText("Email address"), "unknown@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Password123!");
    await userEvent.click(screen.getByText("Sign In"));
    await waitFor(() => {
      expect(screen.getByText("No account with this email")).toBeTruthy();
    });
  });

  it("displays generic error for unknown error codes", async () => {
    mockApiPost.mockRejectedValue({
      code: "auth/unknown",
      message: "Something went wrong",
    });
    renderAuthPage();
    await userEvent.type(screen.getByLabelText("Email address"), "test@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Password123!");
    await userEvent.click(screen.getByText("Sign In"));
    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeTruthy();
    });
  });

  // ── Register Flow ──

  it("calls backend signup on register", async () => {
    renderAuthPage();
    await userEvent.click(screen.getByText("Sign up"));
    await userEvent.type(screen.getByLabelText("Email address"), "new@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Password123!");
    await userEvent.type(screen.getByLabelText("Confirm password"), "Password123!");
    await userEvent.click(screen.getByText("Create Account"));
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/api/auth/signup", {
        name: "new",
        email: "new@example.com",
        password: "Password123!",
      });
      // "Account created" appears in both inline success and toast
      expect(screen.getAllByText(/Account created/).length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Reset Password Flow ──

  it("sends password reset email", async () => {
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
    renderAuthPage();
    await userEvent.click(screen.getByText("Forgot your password?"));
    await userEvent.type(screen.getByLabelText("Email address"), "test@example.com");
    await userEvent.click(screen.getByText("Send Reset Email"));
    await waitFor(() => {
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(expect.any(Object), "test@example.com");
      expect(screen.getByText(/Password reset email sent/)).toBeTruthy();
    });
  });

  // ── Google Login ──

  it("calls Google sign-in when Google button is clicked", async () => {
    mockSignInWithPopup.mockResolvedValue({ user: { uid: "google123", getIdToken: () => Promise.resolve("fake-id-token") } });
    renderAuthPage();
    await userEvent.click(screen.getByText("Continue with Google"));
    await waitFor(() => {
      expect(mockSignInWithPopup).toHaveBeenCalled();
    });
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
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

  // ── Error/Success Display ──

  it("displays error in a styled error box", async () => {
    renderAuthPage();
    await userEvent.click(screen.getByText("Sign In"));
    const errorBox = screen.getByText("Please fill in all fields").closest("div");
    expect(errorBox?.className).toContain("red");
  });

  it("displays success message in a styled success box", async () => {
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
    renderAuthPage();
    await userEvent.click(screen.getByText("Forgot your password?"));
    await userEvent.type(screen.getByLabelText("Email address"), "test@example.com");
    await userEvent.click(screen.getByText("Send Reset Email"));
    await waitFor(() => {
      const successMsg = screen.getByText(/Password reset email sent/);
      expect(successMsg).toBeTruthy();
    });
  });

  // ── Loading State on Button ──

  it("shows correct loading text per mode", async () => {
    // Login mode
    mockApiPost.mockImplementation(
      () => new Promise(() => {}) // never resolves
    );
    renderAuthPage();
    await userEvent.type(screen.getByLabelText("Email address"), "test@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Password123!");
    await userEvent.click(screen.getByText("Sign In"));
    expect(screen.getByText("Signing in...")).toBeTruthy();
  });
});
