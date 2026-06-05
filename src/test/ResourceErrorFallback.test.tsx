import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResourceErrorFallback from "@/components/ui/ResourceErrorFallback";

describe("ResourceErrorFallback", () => {
  it("renders with default props", () => {
    render(<ResourceErrorFallback />);
    expect(screen.getByText("Content Loading")).toBeTruthy();
    expect(screen.getByText("This resource is being prepared for you. Please try again in a moment.")).toBeTruthy();
  });

  it("renders default icon", () => {
    render(<ResourceErrorFallback />);
    const icon = screen.getByText("🔄");
    expect(icon).toBeTruthy();
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("has role=alert for accessibility", () => {
    render(<ResourceErrorFallback />);
    const container = screen.getByRole("alert");
    expect(container).toBeTruthy();
  });

  it("renders custom title and message", () => {
    render(<ResourceErrorFallback title="Oops" message="Something broke." />);
    expect(screen.getByText("Oops")).toBeTruthy();
    expect(screen.getByText("Something broke.")).toBeTruthy();
  });

  it("renders custom icon", () => {
    render(<ResourceErrorFallback icon="🚨" />);
    expect(screen.getByText("🚨")).toBeTruthy();
  });

  it("does not render retry button when onRetry is not provided", () => {
    render(<ResourceErrorFallback />);
    expect(screen.queryByText(/Retry/i)).toBeFalsy();
  });

  it("renders retry button when onRetry is provided", () => {
    render(<ResourceErrorFallback onRetry={vi.fn()} />);
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("calls onRetry when retry button is clicked", async () => {
    const onRetry = vi.fn();
    render(<ResourceErrorFallback onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows 'Retrying…' text while retry is in progress", async () => {
    let resolveRetry: () => void;
    const onRetry = vi.fn(
      () => new Promise<void>((resolve) => { resolveRetry = resolve; })
    );
    render(<ResourceErrorFallback onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(screen.getByText("Retrying…")).toBeTruthy();

    resolveRetry!();
    await waitFor(() => {
      expect(screen.getByText(/.*Retry/)).toBeTruthy();
    });
  });

  it("disables retry button during retry", async () => {
    const onRetry = vi.fn(
      () => new Promise<void>(() => {}) // never resolves
    );
    render(<ResourceErrorFallback onRetry={onRetry} />);

    const btn = screen.getByRole("button", { name: /retry/i });
    expect(btn).not.toBeDisabled();

    await userEvent.click(btn);
    expect(btn).toBeDisabled();
  });

  it("does not call onRetry again if already retrying", async () => {
    const onRetry = vi.fn(
      () => new Promise<void>(() => {}) // never resolves
    );
    render(<ResourceErrorFallback onRetry={onRetry} />);

    const btn = screen.getByRole("button", { name: /retry/i });
    await userEvent.click(btn);
    await userEvent.click(btn); // should be ignored (disabled)

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("re-enables retry button if onRetry throws", async () => {
    const onRetry = vi.fn().mockRejectedValue(new Error("fail"));
    render(<ResourceErrorFallback onRetry={onRetry} />);

    const btn = screen.getByRole("button", { name: /retry/i });
    await userEvent.click(btn);

    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
  });

  it("re-enables retry button after onRetry resolves", async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    render(<ResourceErrorFallback onRetry={onRetry} />);

    const btn = screen.getByRole("button", { name: /retry/i });
    await userEvent.click(btn);

    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
  });
});
