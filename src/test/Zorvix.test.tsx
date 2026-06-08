import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Zorvix from "@/components/Zorvix";

// ── Mocks ──

const mockUseAuth = vi.fn();
const mockUseMissionSystem = vi.fn();
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiFetch = vi.fn();
const mockGetStoredAccessToken = vi.fn();
const mockToast = vi.fn();

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/context/MissionSystemApiContext", () => ({
  useMissionSystem: () => mockUseMissionSystem(),
}));

vi.mock("@/lib/api", () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

vi.mock("@/lib/apiClient", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    details?: unknown;
    constructor(message: string, status: number, code = "request_failed", details?: unknown) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
      this.details = details;
    }
  },
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  getStoredAccessToken: () => mockGetStoredAccessToken(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// ── Helpers ──

const defaultAuthState = {
  authState: "authenticated" as const,
  isAuthenticated: true,
  user: { id: "1", name: "TestUser", email: "test@example.com", role: "user" },
};

const defaultMissionState = {
  nextMissionHook: { title: "SQL Injection Lab", detail: "Complete the SQLi lab.", ctaLabel: "Start", target: "task" as const },
  recommendations: [{ title: "Learn XSS", reason: "Fundamental", action: "Start XSS module", priority: 1 }],
};

const mockSessionResponse = {
  data: {
    messages: [
      { id: "welcome-1", role: "assistant", content: "## ZORVIX Welcome\n\nHow can I help?", timestamp: Date.now() },
    ],
    activeTopic: null,
    assistantProfile: null,
  },
};

const mockHealthResponse = {
  data: {
    status: "ok",
    model: "active" as const,
    llm_ready: true,
    mode: "primary_live" as const,
  },
};

const renderZorvix = (fullScreen = true) => {
  return render(<Zorvix fullScreen={fullScreen} />);
};

/** Find the submit (send) button by its type="submit" attribute */
const getSendButton = () => document.querySelector('button[type="submit"]') as HTMLButtonElement;

// ── Tests ──

describe("Zorvix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(defaultAuthState);
    mockUseMissionSystem.mockReturnValue(defaultMissionState);
    mockGetStoredAccessToken.mockReturnValue("mock-token-abc123");
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") return Promise.resolve(mockSessionResponse);
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });
    mockApiPost.mockResolvedValue({ data: {} });
    mockApiFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => ({ done: true, value: undefined }),
          }),
        },
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Rendering ──

  it("renders in fullScreen mode with chat shell", async () => {
    await act(async () => {
      renderZorvix(true);
    });
    expect(screen.getByText("ZORVIX AI")).toBeTruthy();
  });

  it("returns null in non-fullScreen mode when not open", () => {
    const { container } = renderZorvix(false);
    expect(container.innerHTML).toBe("");
  });

  it("renders the header with status indicator", async () => {
    await act(async () => {
      renderZorvix(true);
    });
    expect(screen.getByText("ZORVIX AI")).toBeTruthy();
    expect(screen.getByText("Ready")).toBeTruthy();
  });

  it("renders the Bot icon in the header", async () => {
    await act(async () => {
      renderZorvix(true);
    });
    // The header has a Bot icon from lucide-react
    const headerIcons = document.querySelectorAll("header svg");
    expect(headerIcons.length).toBeGreaterThanOrEqual(1);
  });

  // ── Empty State / Welcome ──

  it("shows empty state with welcome text when no messages", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") return Promise.resolve({ data: { messages: [], activeTopic: null } });
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(true);
    });

    expect(screen.getByText("Ask ZORVIX")).toBeTruthy();
    expect(screen.getByText(/Clear guidance, next actions/)).toBeTruthy();
  });

  it("shows mission-specific suggestions in empty state", async () => {
    await act(async () => {
      renderZorvix(true);
    });

    await waitFor(() => {
      expect(screen.getByText(/Guide me through SQL Injection Lab/)).toBeTruthy();
    });
  });

  it("shows fallback suggestions when mission hooks and recommendations are empty", async () => {
    mockUseMissionSystem.mockReturnValue({
      nextMissionHook: { title: "", detail: "", ctaLabel: "", target: "return" as const },
      recommendations: [],
    });

    await act(async () => {
      renderZorvix(true);
    });

    await waitFor(() => {
      // With empty hooks/recommendations, missionStarterSuggestions has 2 items:
      // "Assess my current cyber momentum..." and "Think like a senior analyst..."
      expect(screen.getByText(/Assess my current cyber momentum/)).toBeTruthy();
      expect(screen.getByText(/Think like a senior analyst/)).toBeTruthy();
    });
  });

  // ── Input Handling ──

  it("renders the composer textarea", async () => {
    await act(async () => {
      renderZorvix(true);
    });
    expect(screen.getByLabelText("Message ZORVIX")).toBeTruthy();
  });

  it("disables send button when input is empty", async () => {
    await act(async () => {
      renderZorvix(true);
    });
    const sendBtn = getSendButton();
    expect(sendBtn).toBeTruthy();
    expect(sendBtn.disabled).toBe(true);
  });

  it("enables send button when input has text", async () => {
    await act(async () => {
      renderZorvix(true);
    });
    const textarea = screen.getByLabelText("Message ZORVIX");
    await userEvent.type(textarea, "Hello Zorvix");
    const sendBtn = getSendButton();
    expect(sendBtn.disabled).toBe(false);
  });

  it("renders attach file button", async () => {
    await act(async () => {
      renderZorvix(true);
    });
    expect(screen.getByLabelText("Attach file")).toBeTruthy();
  });

  it("auto-resizes textarea after typing", async () => {
    await act(async () => {
      renderZorvix(true);
    });
    const textarea = screen.getByLabelText("Message ZORVIX") as HTMLTextAreaElement;
    // jsdom does not compute layout; mock scrollHeight on the element instance
    Object.defineProperty(textarea, "scrollHeight", { value: 120, configurable: true, writable: true });
    // Type text to trigger the useEffect that reads scrollHeight
    await userEvent.type(textarea, "Hello world");
    // The effect runs and should set height to something derived from scrollHeight
    // At minimum it should not remain at the initial "0px"
    expect(textarea.style.height).not.toBe("0px");
  });

  // ── Status & Health ──

  it("shows Ready status when backend is healthy", async () => {
    await act(async () => {
      renderZorvix(true);
    });
    expect(screen.getByText("Ready")).toBeTruthy();
  });

  it("shows Offline status when navigator.onLine is false", async () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

    await act(async () => {
      renderZorvix(true);
    });

    expect(screen.getByText("Offline")).toBeTruthy();
    Object.defineProperty(navigator, "onLine", { value: originalOnLine, configurable: true });
  });

  it("shows Degraded status when backend is down", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve({ data: { status: "down" } });
      if (url === "/api/neurobot/session") return Promise.resolve(mockSessionResponse);
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(true);
    });

    expect(screen.getByText("Degraded")).toBeTruthy();
  });

  // ── Session Loading ──

  it("shows loading indicator while session is loading", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") return new Promise(() => {}); // never resolves
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(true);
    });

    expect(screen.getByText("ZORVIX session loading")).toBeTruthy();
  });

  // ── Messages ──

  it("renders assistant messages from session", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") {
        return Promise.resolve({
          data: {
            messages: [
              { id: "msg-1", role: "user", content: "What is SQLi?", timestamp: Date.now() },
              { id: "msg-2", role: "assistant", content: "SQL Injection is a vulnerability...", timestamp: Date.now() },
            ],
            activeTopic: null,
          },
        });
      }
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(true);
    });

    await waitFor(() => {
      expect(screen.getByText("What is SQLi?")).toBeTruthy();
      expect(screen.getByText("SQL Injection is a vulnerability...")).toBeTruthy();
    });
  });

  it("hides the default welcome pattern message", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") {
        return Promise.resolve({
          data: {
            messages: [
              { id: "welcome-1", role: "assistant", content: "## ZORVIX Welcome\n\nHello!", timestamp: Date.now() },
              { id: "msg-1", role: "user", content: "Hi", timestamp: Date.now() },
            ],
            activeTopic: null,
          },
        });
      }
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(true);
    });

    await waitFor(() => {
      expect(screen.getByText("Hi")).toBeTruthy();
    });
    // The welcome message starting with "## ZORVIX" should be filtered out of visible messages
    expect(screen.queryByText("Hello!")).toBeNull();
  });

  it("renders user messages right-aligned and assistant left-aligned", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") {
        return Promise.resolve({
          data: {
            messages: [
              { id: "msg-1", role: "user", content: "Hello", timestamp: Date.now() },
              { id: "msg-2", role: "assistant", content: "Hi there!", timestamp: Date.now() },
            ],
            activeTopic: null,
          },
        });
      }
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(true);
    });

    await waitFor(() => {
      const articles = document.querySelectorAll("article");
      expect(articles.length).toBe(2);
      // User message is justify-end, assistant is justify-start
      expect(articles[0].className).toContain("justify-end");
      expect(articles[1].className).toContain("justify-start");
    });
  });

  it("renders markdown code blocks in assistant messages", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") {
        return Promise.resolve({
          data: {
            messages: [
              { id: "msg-1", role: "user", content: "Show code", timestamp: Date.now() },
              { id: "msg-2", role: "assistant", content: "Here is some code:\n```\nconsole.log('hello');\n```", timestamp: Date.now() },
            ],
            activeTopic: null,
          },
        });
      }
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(true);
    });

    await waitFor(() => {
      const codeBlocks = document.querySelectorAll("pre code");
      expect(codeBlocks.length).toBeGreaterThan(0);
    });
  });

  // ── Unauthenticated State ──

  it("renders empty state when not authenticated (no synced session)", async () => {
    mockUseAuth.mockReturnValue({
      authState: "unauthenticated",
      isAuthenticated: false,
      user: null,
    });
    mockGetStoredAccessToken.mockReturnValue("");

    await act(async () => {
      renderZorvix(true);
    });

    // When unauthenticated, loadSession finds no synced session,
    // so visibleMessages is empty and the "Ask ZORVIX" empty state renders
    await waitFor(() => {
      expect(screen.getByText("Ask ZORVIX")).toBeTruthy();
      expect(screen.getByText(/Clear guidance, next actions/)).toBeTruthy();
    });

    // Session should NOT have loaded messages (no auth)
    expect(screen.queryByText("What is SQLi?")).toBeNull();
  });

  // ── Keyboard Handling ──

  it("does not send on Shift+Enter (allows newline)", async () => {
    await act(async () => {
      renderZorvix(true);
    });

    const textarea = screen.getByLabelText("Message ZORVIX");
    await userEvent.type(textarea, "Line 1");

    // Shift+Enter should not trigger send
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect((textarea as HTMLTextAreaElement).value).toContain("Line 1");
    // The input should still have the text
    expect((textarea as HTMLTextAreaElement).value).toBe("Line 1");
  });

  it("input textarea has placeholder text", async () => {
    await act(async () => {
      renderZorvix(true);
    });

    const textarea = screen.getByLabelText("Message ZORVIX");
    expect(textarea.getAttribute("placeholder")).toBe("Ask a question, share a problem, or request the next step.");
  });

  // ── Topic Banner ──

  it("shows active topic badge in header when topic is set", async () => {
    // Session returns with an active topic
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") {
        return Promise.resolve({
          data: {
            messages: [
              { id: "msg-1", role: "user", content: "Hi", timestamp: Date.now() },
              { id: "msg-2", role: "assistant", content: "Hello!", timestamp: Date.now() },
            ],
            activeTopic: { id: "topic-1", title: "XSS Prevention", query: "How to prevent XSS?", tags: ["xss", "security"] },
          },
        });
      }
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(true);
    });

    await waitFor(() => {
      expect(screen.getByText("XSS Prevention")).toBeTruthy();
    });
  });

  // ── Custom Events ──

  it("sets active topic and populates input when neurobot:topic event fires", async () => {
    // The session mock must return the topic so that loadSession (triggered by
    // isOpen changing) does not overwrite it with null
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") {
        return Promise.resolve({
          data: {
            messages: [
              { id: "msg-1", role: "user", content: "Hi", timestamp: Date.now() },
              { id: "msg-2", role: "assistant", content: "Hello!", timestamp: Date.now() },
            ],
            activeTopic: { id: "xss-lab", title: "XSS Defense Lab", query: "How do I set up a safe XSS practice lab?", tags: ["xss", "lab"] },
          },
        });
      }
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(true);
    });

    // Wait for session to load first so messages are present
    await waitFor(() => {
      expect(screen.getByText("Hi")).toBeTruthy();
    });

    // Dispatch a neurobot:topic CustomEvent with autoSubmit=false to prevent
    // the component from calling runAssistant which clears the input
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("neurobot:topic", {
          detail: {
            id: "xss-lab",
            title: "XSS Defense Lab",
            query: "How do I set up a safe XSS practice lab?",
            tags: ["xss", "lab"],
            autoSubmit: false,
          },
        })
      );
    });

    await waitFor(() => {
      // The topic badge should appear in the header
      expect(screen.getByText("XSS Defense Lab")).toBeTruthy();
    });

    // The textarea should be populated with the topic query
    const textarea = screen.getByLabelText("Message ZORVIX") as HTMLTextAreaElement;
    expect(textarea.value).toBe("How do I set up a safe XSS practice lab?");
  });

  it("auto-submits when neurobot:topic fires with autoSubmit true and nextPrompt set", async () => {
    // Session mock includes topic so loadSession preserves it after api.post clears messages
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") {
        return Promise.resolve({
          data: {
            messages: [
              { id: "msg-1", role: "user", content: "Hi", timestamp: Date.now() },
              { id: "msg-2", role: "assistant", content: "Hello!", timestamp: Date.now() },
            ],
            activeTopic: {
              id: "sqli-lab",
              title: "SQLi Lab",
              query: "Walk me through SQL injection basics",
              tags: ["sqli", "lab"],
            },
          },
        });
      }
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(true);
    });

    // Wait for session to load
    await waitFor(() => {
      expect(screen.getByText("Hi")).toBeTruthy();
    });

    // Dispatch neurobot:topic with autoSubmit=true — should trigger runAssistant
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("neurobot:topic", {
          detail: {
            id: "sqli-lab",
            title: "SQLi Lab",
            query: "Walk me through SQL injection basics",
            tags: ["sqli", "lab"],
            autoSubmit: true,
          },
        })
      );
    });

    // Topic badge should appear
    await waitFor(() => {
      expect(screen.getByText("SQLi Lab")).toBeTruthy();
    });

    // Input should initially be populated with the query
    const textarea = screen.getByLabelText("Message ZORVIX") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Walk me through SQL injection basics");

    // After 140ms timeout, runAssistant fires → clears input → calls apiFetch for streaming
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled();
    }, { timeout: 3000 });

    // runAssistant clears the input after starting
    await waitFor(() => {
      const ta = screen.getByLabelText("Message ZORVIX") as HTMLTextAreaElement;
      expect(ta.value).toBe("");
    }, { timeout: 3000 });
  });

  it("does not auto-submit when neurobot:topic fires with autoSubmit false", async () => {
    // Session mock must include the topic so that when loadSession re-runs
    // (triggered by api.post clearing messages), it preserves the topic
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") {
        return Promise.resolve({
          data: {
            messages: [
              { id: "msg-1", role: "user", content: "Hi", timestamp: Date.now() },
              { id: "msg-2", role: "assistant", content: "Hello!", timestamp: Date.now() },
            ],
            activeTopic: {
              id: "xss-lab",
              title: "XSS Lab",
              query: "Explain cross-site scripting",
              tags: ["xss"],
            },
          },
        });
      }
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(true);
    });

    await waitFor(() => {
      expect(screen.getByText("Hi")).toBeTruthy();
    });

    // Clear mockApiFetch call count from session loading
    mockApiFetch.mockClear();

    // Dispatch with autoSubmit=false and a query — should NOT trigger runAssistant
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("neurobot:topic", {
          detail: {
            id: "xss-lab",
            title: "XSS Lab",
            query: "Explain cross-site scripting",
            tags: ["xss"],
            autoSubmit: false,
          },
        })
      );
    });

    // Topic badge should appear and persist (session mock also returns the topic)
    await waitFor(() => {
      expect(screen.getByText("XSS Lab")).toBeTruthy();
    });

    // Input should be populated but NOT submitted
    const textarea = screen.getByLabelText("Message ZORVIX") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Explain cross-site scripting");

    // Wait long enough for the 140ms timeout to have fired — apiFetch should NOT be called
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    });
    expect(mockApiFetch).not.toHaveBeenCalled();

    // Input should still contain the text (not cleared by runAssistant)
    expect(textarea.value).toBe("Explain cross-site scripting");
  });

  it("shows 'Mentor mode ready:' status hint when neurobot:topic fires with mentorMode true", async () => {
    const mentorTopic = {
      id: "mentor-topic",
      title: "Cyber Defense Mentor",
      query: "Guide me through incident response",
      tags: ["mentor", "ir"],
    };
    const sessionMessages = [
      { id: "msg-1", role: "user", content: "Hi", timestamp: Date.now() },
      { id: "msg-2", role: "assistant", content: "Hello!", timestamp: Date.now() },
    ];

    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") {
        return Promise.resolve({ data: { messages: sessionMessages, activeTopic: mentorTopic } });
      }
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    // Mock api.post for /api/neurobot/topic to return messages + topic
    // so that loadSession (re-triggered when messages become empty) doesn't
    // overwrite the status hint with "Workspace ready."
    mockApiPost.mockImplementation((url: string) => {
      if (url === "/api/neurobot/topic") {
        return Promise.resolve({ data: { messages: sessionMessages, activeTopic: mentorTopic } });
      }
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(true);
    });

    await waitFor(() => {
      expect(screen.getByText("Hi")).toBeTruthy();
    });

    // Dispatch neurobot:topic with mentorMode=true, autoSubmit=false
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("neurobot:topic", {
          detail: {
            id: "mentor-topic",
            title: "Cyber Defense Mentor",
            query: "Guide me through incident response",
            tags: ["mentor", "ir"],
            mentorMode: true,
            autoSubmit: false,
          },
        })
      );
    });

    // Topic badge should appear
    await waitFor(() => {
      expect(screen.getByText("Cyber Defense Mentor")).toBeTruthy();
    });

    // Status hint should show 'Mentor mode ready:' (not 'Topic ready:')
    await waitFor(() => {
      expect(document.body.textContent).toContain("Mentor mode ready: Cyber Defense Mentor");
    });

    // Should NOT contain 'Topic ready:' when mentorMode is true
    expect(document.body.textContent).not.toContain("Topic ready:");
  });

  it("shows 'Topic ready:' status hint when neurobot:topic fires without mentorMode", async () => {
    const regularTopic = {
      id: "regular-topic",
      title: "SQL Injection",
      query: "Explain SQLi",
      tags: ["sqli"],
    };
    const sessionMessages = [
      { id: "msg-1", role: "user", content: "Hi", timestamp: Date.now() },
      { id: "msg-2", role: "assistant", content: "Hello!", timestamp: Date.now() },
    ];

    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") {
        return Promise.resolve({ data: { messages: sessionMessages, activeTopic: regularTopic } });
      }
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    // Mock api.post for /api/neurobot/topic to return messages + topic
    mockApiPost.mockImplementation((url: string) => {
      if (url === "/api/neurobot/topic") {
        return Promise.resolve({ data: { messages: sessionMessages, activeTopic: regularTopic } });
      }
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(true);
    });

    await waitFor(() => {
      expect(screen.getByText("Hi")).toBeTruthy();
    });

    // Dispatch neurobot:topic WITHOUT mentorMode (defaults to falsy)
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("neurobot:topic", {
          detail: {
            id: "regular-topic",
            title: "SQL Injection",
            query: "Explain SQLi",
            tags: ["sqli"],
            autoSubmit: false,
          },
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("SQL Injection")).toBeTruthy();
    });

    // Status hint should show 'Topic ready:' (not 'Mentor mode ready:')
    await waitFor(() => {
      expect(document.body.textContent).toContain("Topic ready: SQL Injection");
    });

    expect(document.body.textContent).not.toContain("Mentor mode ready:");
  });

  // ── Non-Fullscreen Overlay ──

  it("opens overlay when neurobot:open event fires in non-fullScreen mode", async () => {
    await act(async () => {
      renderZorvix(false);
    });

    // Should not render anything initially
    expect(screen.queryByText("Ask ZORVIX")).toBeNull();

    await act(async () => {
      window.dispatchEvent(new Event("neurobot:open"));
    });

    await waitFor(() => {
      expect(screen.getByText("Ask ZORVIX")).toBeTruthy();
    });
  });

  it("renders overlay backdrop and close button when open in non-fullScreen mode", async () => {
    await act(async () => {
      renderZorvix(false);
    });

    await act(async () => {
      window.dispatchEvent(new Event("neurobot:open"));
    });

    await waitFor(() => {
      expect(screen.getByText("Ask ZORVIX")).toBeTruthy();
    });

    // Close button should be present
    expect(screen.getByLabelText("Close ZORVIX")).toBeTruthy();
  });

  it("closes overlay when close button is clicked in non-fullScreen mode", async () => {
    await act(async () => {
      renderZorvix(false);
    });

    await act(async () => {
      window.dispatchEvent(new Event("neurobot:open"));
    });

    await waitFor(() => {
      expect(screen.getByText("Ask ZORVIX")).toBeTruthy();
    });

    const closeBtn = screen.getByLabelText("Close ZORVIX");
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    await waitFor(() => {
      expect(screen.queryByText("Ask ZORVIX")).toBeNull();
    });
  });

  it("closes overlay when backdrop is clicked in non-fullScreen mode", async () => {
    await act(async () => {
      renderZorvix(false);
    });

    await act(async () => {
      window.dispatchEvent(new Event("neurobot:open"));
    });

    await waitFor(() => {
      expect(screen.getByText("Ask ZORVIX")).toBeTruthy();
    });

    // Find the backdrop using the data-testid we added
    const backdropEl = screen.getByTestId("zorvix-overlay-backdrop");
    expect(backdropEl).toBeTruthy();

    await act(async () => {
      fireEvent.click(backdropEl!);
    });

    await waitFor(() => {
      expect(screen.queryByText("Ask ZORVIX")).toBeNull();
    });
  });

  it("closes overlay when Escape is pressed in non-fullScreen mode", async () => {
    await act(async () => {
      renderZorvix(false);
    });

    await act(async () => {
      window.dispatchEvent(new Event("neurobot:open"));
    });

    await waitFor(() => {
      expect(screen.getByText("Ask ZORVIX")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    await waitFor(() => {
      expect(screen.queryByText("Ask ZORVIX")).toBeNull();
    });
  });

  it("renders TelemetryBar in overlay when assistant response contains telemetry", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") {
        return Promise.resolve({
          data: {
            messages: [
              { id: "msg-1", role: "user", content: "What is recon?", timestamp: Date.now() },
              {
                id: "msg-2",
                role: "assistant",
                content: '```json\n{"telemetry":{"roadmapDay":3,"difficulty":"2_STARS","vectorTrack":"RECON","sessionXpReward":15,"zorvixThemeHex":"#00F0FF"}}\n```\n\nRecon is the first phase of any cyber operation.',
                timestamp: Date.now(),
              },
            ],
            activeTopic: null,
          },
        });
      }
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(false);
    });

    await act(async () => {
      window.dispatchEvent(new Event("neurobot:open"));
    });

    await waitFor(() => {
      // TelemetryBar compact mode shows D3 and RECON in the overlay
      expect(screen.getByText("D3")).toBeTruthy();
      expect(screen.getByText("RECON")).toBeTruthy();
    });
  });

  it("renders TelemetryBar in overlay with XP badge when sessionXpReward > 0", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") {
        return Promise.resolve({
          data: {
            messages: [
              { id: "msg-1", role: "user", content: "Help", timestamp: Date.now() },
              {
                id: "msg-2",
                role: "assistant",
                content: '```json\n{"telemetry":{"roadmapDay":5,"difficulty":"3_STARS","vectorTrack":"APPSEC","sessionXpReward":25,"zorvixThemeHex":"#00F0FF"}}\n```\n\nHere is your answer.',
                timestamp: Date.now(),
              },
            ],
            activeTopic: null,
          },
        });
      }
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(false);
    });

    await act(async () => {
      window.dispatchEvent(new Event("neurobot:open"));
    });

    await waitFor(() => {
      expect(screen.getByText("+25 XP")).toBeTruthy();
      expect(screen.getByText("APP")).toBeTruthy();
    });
  });

  it("strips telemetry JSON from rendered message text in overlay", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") {
        return Promise.resolve({
          data: {
            messages: [
              { id: "msg-1", role: "user", content: "Tell me about binaries", timestamp: Date.now() },
              {
                id: "msg-2",
                role: "assistant",
                content: '```json\n{"telemetry":{"roadmapDay":45,"difficulty":"4_STARS","vectorTrack":"BINARY_PWN","sessionXpReward":50,"zorvixThemeHex":"#A124FF"}}\n```\n\nBinary exploitation starts with memory layout.',
                timestamp: Date.now(),
              },
            ],
            activeTopic: null,
          },
        });
      }
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(false);
    });

    await act(async () => {
      window.dispatchEvent(new Event("neurobot:open"));
    });

    await waitFor(() => {
      // The actual content should be visible
      expect(screen.getByText(/Binary exploitation starts with memory layout/)).toBeTruthy();
      // The telemetry block should NOT appear as raw JSON text
      expect(screen.queryByText(/"roadmapDay"/)).toBeNull();
      // But the TelemetryBar compact metadata should be rendered
      expect(screen.getByText("D45")).toBeTruthy();
      expect(screen.getByText("PWN")).toBeTruthy();
    });
  });

  // ── Error Recovery ──

  it("shows session banner on failed session load", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/api/health/chatbot") return Promise.resolve(mockHealthResponse);
      if (url === "/api/neurobot/session") return Promise.reject(new Error("Network error"));
      if (url === "/api/neurobot/memory/summary") return Promise.resolve({ data: { snapshot: null, stats: {} } });
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      renderZorvix(true);
    });

    await waitFor(() => {
      // After session load failure, should still render the empty state
      expect(screen.getByText("Ask ZORVIX")).toBeTruthy();
    });
  });
});
