import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BeltBadge from "../../components/BeltBadge";

describe("BeltBadge", () => {
  it("renders belt name", () => {
    render(<BeltBadge belt="Siyah Kuşak" />);
    expect(screen.getByText("Siyah Kuşak")).toBeInTheDocument();
  });

  it("renders with dot by default", () => {
    const { container } = render(<BeltBadge belt="Mavi" />);
    const dots = container.querySelectorAll("span.rounded-full");
    expect(dots.length).toBeGreaterThanOrEqual(2);
  });

  it("hides dot when showDot=false", () => {
    const { container } = render(<BeltBadge belt="Mavi" showDot={false} />);
    const dots = container.querySelectorAll("span.rounded-full");
    expect(dots.length).toBe(1);
  });

  it("applies sm size classes by default", () => {
    const { container } = render(<BeltBadge belt="Beyaz" />);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain("text-[10px]");
  });

  it("applies md size classes when size=md", () => {
    const { container } = render(<BeltBadge belt="Beyaz" size="md" />);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain("text-xs");
  });
});