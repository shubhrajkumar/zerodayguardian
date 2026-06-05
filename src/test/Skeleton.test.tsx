import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton, SkeletonCard, SkeletonAvatar, SkeletonLine } from "@/components/ui/skeleton";

describe("Skeleton", () => {
  it("renders a div with shimmer animation", () => {
    render(<Skeleton />);
    const el = document.querySelector(".animate-shimmer");
    expect(el).toBeTruthy();
  });

  it("sets aria-hidden for accessibility", () => {
    render(<Skeleton />);
    const el = document.querySelector(".animate-shimmer") as HTMLElement;
    expect(el.getAttribute("aria-hidden")).toBe("true");
  });

  it("applies custom width via w prop", () => {
    render(<Skeleton w="200px" />);
    const el = document.querySelector(".animate-shimmer") as HTMLElement;
    expect(el.style.width).toBe("200px");
  });

  it("applies custom height via h prop", () => {
    render(<Skeleton h="40px" />);
    const el = document.querySelector(".animate-shimmer") as HTMLElement;
    expect(el.style.height).toBe("40px");
  });

  it("applies custom border-radius via r prop", () => {
    render(<Skeleton r="16px" />);
    const el = document.querySelector(".animate-shimmer") as HTMLElement;
    expect(el.style.borderRadius).toBe("16px");
  });

  it("does not set width/height/radius when props are omitted", () => {
    render(<Skeleton />);
    const el = document.querySelector(".animate-shimmer") as HTMLElement;
    expect(el.style.width).toBe("");
    expect(el.style.height).toBe("");
    expect(el.style.borderRadius).toBe("");
  });

  it("applies className alongside animate-shimmer", () => {
    render(<Skeleton className="my-custom-class" />);
    const el = document.querySelector(".animate-shimmer") as HTMLElement;
    expect(el.className).toContain("my-custom-class");
  });

  it("merges inline style when provided", () => {
    render(<Skeleton style={{ opacity: 0.5 }} />);
    const el = document.querySelector(".animate-shimmer") as HTMLElement;
    expect(el.style.opacity).toBe("0.5");
  });

  it("spreads extra HTML attributes", () => {
    render(<Skeleton data-testid="skel" role="presentation" />);
    const el = screen.getByTestId("skel");
    expect(el.getAttribute("role")).toBe("presentation");
  });
});

describe("SkeletonCard", () => {
  it("renders a container with aria-busy and aria-label", () => {
    render(<SkeletonCard />);
    const el = screen.getByLabelText("Loading...");
    expect(el).toBeTruthy();
    expect(el.getAttribute("aria-busy")).toBe("true");
  });

  it("renders 4 skeleton lines inside", () => {
    const { container } = render(<SkeletonCard />);
    const skeletons = container.querySelectorAll(".animate-shimmer");
    expect(skeletons.length).toBe(4);
  });

  it("applies custom className", () => {
    render(<SkeletonCard className="extra-class" />);
    const el = screen.getByLabelText("Loading...");
    expect(el.className).toContain("extra-class");
  });
});

describe("SkeletonAvatar", () => {
  it("renders with default 40px size", () => {
    const { container } = render(<SkeletonAvatar />);
    const el = container.querySelector(".animate-shimmer") as HTMLElement;
    expect(el.style.width).toBe("40px");
    expect(el.style.height).toBe("40px");
  });

  it("renders with custom size", () => {
    const { container } = render(<SkeletonAvatar size={80} />);
    const el = container.querySelector(".animate-shimmer") as HTMLElement;
    expect(el.style.width).toBe("80px");
    expect(el.style.height).toBe("80px");
  });

  it("applies circular border-radius", () => {
    const { container } = render(<SkeletonAvatar />);
    const el = container.querySelector(".animate-shimmer") as HTMLElement;
    expect(el.style.borderRadius).toBe("var(--radius-full, 9999px)");
  });
});

describe("SkeletonLine", () => {
  it("renders with default 100% width and 14px height", () => {
    const { container } = render(<SkeletonLine />);
    const el = container.querySelector(".animate-shimmer") as HTMLElement;
    expect(el.style.width).toBe("100%");
    expect(el.style.height).toBe("14px");
  });

  it("renders with custom width", () => {
    const { container } = render(<SkeletonLine width="50%" />);
    const el = container.querySelector(".animate-shimmer") as HTMLElement;
    expect(el.style.width).toBe("50%");
  });
});
