import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import BalanceSparkline from "@/components/BalanceSparkline";

describe("BalanceSparkline", () => {
  it("renders nothing with fewer than two points", () => {
    const { container } = render(<BalanceSparkline data={[100]} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("uses the success color for an upward (or flat) trend", () => {
    const { container } = render(<BalanceSparkline data={[100, 120, 150]} />);
    const path = container.querySelector("path");
    expect(path).not.toBeNull();
    expect(path?.getAttribute("stroke")).toBe("var(--color-success)");
  });

  it("uses the danger color for a downward trend", () => {
    const { container } = render(<BalanceSparkline data={[150, 120, 90]} />);
    expect(container.querySelector("path")?.getAttribute("stroke")).toBe(
      "var(--color-danger)"
    );
  });

  it("hides the end dot when showDot is false", () => {
    const { container } = render(
      <BalanceSparkline data={[100, 120]} showDot={false} />
    );
    expect(container.querySelector("circle")).toBeNull();
  });

  it("draws a path that starts with a move and contains a line command", () => {
    const { container } = render(<BalanceSparkline data={[10, 20, 15, 30]} />);
    const d = container.querySelector("path")?.getAttribute("d") ?? "";
    expect(d.startsWith("M")).toBe(true);
    expect(d).toContain("L");
  });
});
