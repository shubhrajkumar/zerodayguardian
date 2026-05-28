import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OllamaChat from "@/components/OllamaChat";

// Welcome message contains bold markers around name: `Hello, I'm **Zorvix AI**`
const WELCOME_TEXT = /Hello, I'm/;
const ASYNC_TIMEOUT = 10000;

const renderChat = (props: Partial<Parameters<typeof OllamaChat>[0]> = {}) => {
  return render(<OllamaChat {...props} />);
};

describe("OllamaChat", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  // ── Initial Render ──

  it("renders welcome message from agent", () => {
    renderChat();
    expect(screen.getByText(WELCOME_TEXT)).toBeTruthy();
    // "Zorvix AI" appears in the message header <span> and bold <strong> welcome text
    expect(screen.getAllByText("Zorvix AI").length).toBeGreaterThanOrEqual(1);
  });

  it("renders with custom agent name", () => {
    renderChat({ agentName: "CyberBot" });
    expect(screen.getByText(/Hello, I'm/)).toBeTruthy();
    expect(screen.getAllByText("CyberBot").length).toBeGreaterThanOrEqual(1);
  });

  it("renders textarea input with placeholder", () => {
    renderChat();
    expect(
      screen.getByPlaceholderText("Ask Zorvix anything about cybersecurity...")
    ).toBeTruthy();
  });

  it("renders custom placeholder text", () => {
    renderChat({ placeholder: "Ask me anything..." });
    expect(screen.getByPlaceholderText("Ask me anything...")).toBeTruthy();
  });

  it("renders send button", () => {
    renderChat();
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("renders disclaimer text", () => {
    renderChat();
    expect(
      screen.getByText(/may produce inaccurate information/)
    ).toBeTruthy();
  });

  // ── Send Button State ──

  it("disables send button when input is empty", () => {
    renderChat();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("enables send button when input has text", async () => {
    renderChat();
    await userEvent.type(screen.getByRole("textbox"), "Hello");
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  // ── Sending Messages ──

  it("adds user message when send is clicked", async () => {
    renderChat();
    await userEvent.type(screen.getByRole("textbox"), "What is a firewall?");
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText("What is a firewall?")).toBeTruthy();
  });

  it("clears input after sending", async () => {
    renderChat();
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Hello");
    await userEvent.click(screen.getByRole("button"));
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });

  it("sends message on Enter key press", async () => {
    renderChat();
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Hello");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("does not send on Shift+Enter", async () => {
    renderChat();
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Hello");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(screen.getByDisplayValue("Hello")).toBeTruthy();
  });

  it("does not send empty message", async () => {
    renderChat();
    const initial = screen.getByText(WELCOME_TEXT);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText(WELCOME_TEXT)).toBe(initial);
  });

  it("does not send whitespace-only message", async () => {
    renderChat();
    await userEvent.type(screen.getByRole("textbox"), "   ");
    await userEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("   ")).toBeFalsy();
  });

  // ── Typing Indicator ──

  it("shows typing indicator after sending a message", async () => {
    renderChat();
    await userEvent.type(screen.getByRole("textbox"), "Hello");
    await userEvent.click(screen.getByRole("button"));
    expect(document.querySelectorAll(".animate-typing-dot").length).toBe(3);
  });

  it("hides typing indicator after response is generated", async () => {
    renderChat();
    await userEvent.type(screen.getByRole("textbox"), "Hello");
    await userEvent.click(screen.getByRole("button"));
    await waitFor(
      () =>
        expect(document.querySelectorAll(".animate-typing-dot").length).toBe(0),
      { timeout: ASYNC_TIMEOUT }
    );
  }, ASYNC_TIMEOUT);

  it("re-enables input after response", async () => {
    renderChat();
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Hello");
    await userEvent.click(screen.getByRole("button"));
    expect(textarea).toBeDisabled();
    await waitFor(
      () => expect(textarea).not.toBeDisabled(),
      { timeout: ASYNC_TIMEOUT }
    );
  }, ASYNC_TIMEOUT);

  // ── Assistant Response ──

  it("renders assistant response after user message", async () => {
    renderChat();
    await userEvent.type(screen.getByRole("textbox"), "Hello");
    await userEvent.click(screen.getByRole("button"));
    await waitFor(
      () => expect(screen.getByText(/I'm a local AI assistant/)).toBeTruthy(),
      { timeout: ASYNC_TIMEOUT }
    );
  }, ASYNC_TIMEOUT);

  // ── Custom onSend Handler ──

  it("uses custom onSend handler when provided", async () => {
    const mockOnSend = vi.fn().mockResolvedValue("Custom response");
    renderChat({ onSend: mockOnSend });
    await userEvent.type(screen.getByRole("textbox"), "Test message");
    await userEvent.click(screen.getByRole("button"));
    expect(mockOnSend).toHaveBeenCalledWith("Test message");
    await waitFor(
      () => expect(screen.getByText("Custom response")).toBeTruthy(),
      { timeout: ASYNC_TIMEOUT }
    );
  }, ASYNC_TIMEOUT);

  it("shows error message when onSend throws", async () => {
    const mockOnSend = vi.fn().mockRejectedValue(new Error("Network error"));
    renderChat({ onSend: mockOnSend });
    await userEvent.type(screen.getByRole("textbox"), "Test");
    await userEvent.click(screen.getByRole("button"));
    await waitFor(
      () =>
        expect(
          screen.getByText(
            "I encountered an error processing your request. Please try again."
          )
        ).toBeTruthy(),
      { timeout: ASYNC_TIMEOUT }
    );
  }, ASYNC_TIMEOUT);

  // ── Code Block Rendering ──

  it("renders code blocks from response", async () => {
    renderChat();
    await userEvent.type(screen.getByRole("textbox"), "Show code");
    await userEvent.click(screen.getByRole("button"));
    await waitFor(
      () =>
        expect(document.querySelectorAll("pre").length).toBeGreaterThan(0),
      { timeout: ASYNC_TIMEOUT }
    );
  }, ASYNC_TIMEOUT);

  it("renders code block language label", async () => {
    renderChat();
    await userEvent.type(screen.getByRole("textbox"), "Show python");
    await userEvent.click(screen.getByRole("button"));
    await waitFor(
      () => expect(screen.getByText("python")).toBeTruthy(),
      { timeout: ASYNC_TIMEOUT }
    );
  }, ASYNC_TIMEOUT);

  it("renders copy button on code blocks", async () => {
    renderChat();
    await userEvent.type(screen.getByRole("textbox"), "Show code");
    await userEvent.click(screen.getByRole("button"));
    await waitFor(
      () =>
        expect(screen.getAllByText("Copy").length).toBeGreaterThan(0),
      { timeout: ASYNC_TIMEOUT }
    );
  }, ASYNC_TIMEOUT);

  // ── Bold Text ──

  it("renders bold text in messages", () => {
    renderChat();
    expect(document.querySelectorAll("strong").length).toBeGreaterThan(0);
  });

  // ── Timestamp ──

  it("renders timestamp for each message", () => {
    renderChat();
    expect(
      document.querySelectorAll('[class*="text-right"]').length
    ).toBeGreaterThan(0);
  });

  // ── Welcome Message Content ──

  it("welcome message lists help categories", () => {
    renderChat();
    expect(screen.getByText(/Threat analysis/)).toBeTruthy();
    expect(screen.getByText(/Security tool configuration/)).toBeTruthy();
    expect(screen.getByText(/Code review/)).toBeTruthy();
    expect(screen.getByText(/Security best practices/)).toBeTruthy();
  });
});
