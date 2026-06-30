import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import EmptyState from "@/components/EmptyState";

describe("EmptyState", () => {
  it("renders the title and description", () => {
    const { getByText } = render(
      <EmptyState title="No transactions" description="Add your first one" />
    );
    expect(getByText("No transactions")).toBeInTheDocument();
    expect(getByText("Add your first one")).toBeInTheDocument();
  });

  it("renders an emoji when no icon is provided", () => {
    const { getByText } = render(<EmptyState emoji="📭" />);
    expect(getByText("📭")).toBeInTheDocument();
  });

  it("renders no action button without both actionLabel and onAction", () => {
    const { queryByRole } = render(<EmptyState title="Empty" actionLabel="Add" />);
    expect(queryByRole("button")).toBeNull();
  });

  it("fires onAction when the action button is clicked", () => {
    const onAction = vi.fn();
    const { getByRole } = render(
      <EmptyState title="Empty" actionLabel="Add" onAction={onAction} />
    );
    fireEvent.click(getByRole("button", { name: "Add" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
