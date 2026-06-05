import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PasswordInput from "@/components/ui/PasswordInput";

describe("PasswordInput", () => {
  it("renders an input with type password by default", () => {
    render(<PasswordInput />);
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("toggles to text type when eye button is clicked", async () => {
    render(<PasswordInput />);
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("password");

    const toggle = screen.getByRole("button", { name: /show password/i });
    await userEvent.click(toggle);

    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: /hide password/i })).toBeTruthy();
  });

  it("toggles back to password type on second click", async () => {
    render(<PasswordInput />);
    const toggle = screen.getByRole("button", { name: /show password/i });
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole("button", { name: /hide password/i }));

    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("renders label when provided and links to input via htmlFor", () => {
    render(<PasswordInput label="My Password" id="test-pw" />);
    const label = screen.getByText("My Password");
    expect(label).toBeTruthy();
    expect(label.getAttribute("for")).toBe("test-pw");

    const input = document.getElementById("test-pw") as HTMLInputElement;
    expect(input).toBeTruthy();
  });

  it("generates unique id when no id prop is provided", () => {
    const { unmount } = render(<PasswordInput label="First" />);
    const firstInput = document.querySelector("input") as HTMLInputElement;
    const firstId = firstInput.id;

    unmount();
    render(<PasswordInput label="Second" />);
    const secondInput = document.querySelector("input") as HTMLInputElement;
    expect(secondInput.id).not.toBe(firstId);
  });

  it("shows error message with role=alert", () => {
    render(<PasswordInput error="Field is required" />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Field is required");
  });

  it("applies error styling class to input", () => {
    render(<PasswordInput error="Bad input" />);
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.className).toContain("border-[var(--accent-red");
  });

  it("hides error when error prop is not set", () => {
    render(<PasswordInput />);
    expect(screen.queryByRole("alert")).toBeFalsy();
  });

  it("does not show strength meter by default", () => {
    render(<PasswordInput value="test" />);
    expect(screen.queryByText("Weak")).toBeFalsy();
    expect(screen.queryByText("Strong")).toBeFalsy();
  });

  it("shows strength meter when showStrength is true", () => {
    render(<PasswordInput value="Password123!" showStrength />);
    expect(screen.getByText("Strong")).toBeTruthy();
  });

  it("shows Weak for short lowercase-only password", () => {
    render(<PasswordInput value="abc" showStrength />);
    expect(screen.getByText("Weak")).toBeTruthy();
  });

  it("shows Fair for password with 2 criteria met", () => {
    // uppercase + digit = 2 (length < 10)
    render(<PasswordInput value="Password1" showStrength />);
    expect(screen.getByText("Fair")).toBeTruthy();
  });

  it("shows Good for password with 3 criteria met", () => {
    // uppercase + digit + special = 3 (length < 10)
    render(<PasswordInput value="Pass1!" showStrength />);
    expect(screen.getByText("Good")).toBeTruthy();
  });

  it("shows Strong for password meeting all 4 criteria", () => {
    // length >= 10 + uppercase + digit + special = 4
    render(<PasswordInput value="Password1!" showStrength />);
    expect(screen.getByText("Strong")).toBeTruthy();
  });

  it("renders 4 strength bar segments", () => {
    const { container } = render(<PasswordInput value="test" showStrength />);
    const bars = container.querySelectorAll(".h-1.flex-1.rounded-full");
    expect(bars.length).toBe(4);
  });

  it("forwards ref to the input element", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<PasswordInput ref={ref} />);
    expect(ref.current).toBeTruthy();
    expect(ref.current?.tagName).toBe("INPUT");
  });

  it("passes through standard input props", () => {
    render(<PasswordInput placeholder="Enter password" disabled />);
    const input = screen.getByPlaceholderText("Enter password") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("does not show strength meter when showStrength is true but value is not a string", () => {
    // When no value is passed, strength should not render
    render(<PasswordInput showStrength />);
    expect(screen.queryByText("Weak")).toBeFalsy();
    expect(screen.queryByText("Strong")).toBeFalsy();
  });

  it("applies custom className to input", () => {
    render(<PasswordInput className="extra-class" />);
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.className).toContain("extra-class");
  });
});
