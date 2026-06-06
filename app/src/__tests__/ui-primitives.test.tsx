import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { TrendPill } from "@/components/ui/TrendPill";
import { CategoryDot } from "@/components/ui/CategoryDot";
import { Badge } from "@/components/ui/Badge";

describe("AnimatedCounter", () => {
  it("renders the prefix and final value", () => {
    render(<AnimatedCounter value={1000} prefix="₹" duration={0} />);
    expect(screen.getByText(/₹/)).toBeInTheDocument();
  });

  it("compact mode adds Lakh suffix", () => {
    render(<AnimatedCounter value={100000} compact duration={0} />);
    expect(screen.getByText(/L/)).toBeInTheDocument();
  });

  it("negative value renders with minus sign", () => {
    render(<AnimatedCounter value={-500} duration={0} />);
    expect(screen.getByText(/-/)).toBeInTheDocument();
  });
});

describe("TrendPill", () => {
  it("renders positive delta with up arrow + success color", () => {
    const { container } = render(<TrendPill delta={5.2} />);
    expect(container.textContent).toContain("5.2%");
    expect(container.firstChild).toHaveClass("text-success");
  });

  it("renders negative delta with down arrow + danger color", () => {
    const { container } = render(<TrendPill delta={-3.1} />);
    expect(container.firstChild).toHaveClass("text-danger");
  });

  it("flat delta uses muted color", () => {
    const { container } = render(<TrendPill delta={0.01} />);
    expect(container.firstChild).toHaveClass("text-muted-foreground");
  });

  it("higherIsBetter=false flips colors", () => {
    const { container } = render(<TrendPill delta={5} higherIsBetter={false} />);
    expect(container.firstChild).toHaveClass("text-danger"); // up is bad
  });
});

describe("CategoryDot", () => {
  it("renders with default size + color", () => {
    const { container } = render(<CategoryDot />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders label", () => {
    render(<CategoryDot label="FD" />);
    expect(screen.getByText("FD")).toBeInTheDocument();
  });

  it("respects custom color via inline style", () => {
    const { container } = render(<CategoryDot color="#ff0000" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.backgroundColor).toBe("rgb(255, 0, 0)");
  });
});

describe("Badge", () => {
  it("renders with success variant", () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    expect(container.firstChild).toHaveClass("text-success");
  });

  it("pulse applies animation class", () => {
    const { container } = render(<Badge pulse>Alert</Badge>);
    expect(container.firstChild).toHaveClass("animate-pulse-soft");
  });
});
