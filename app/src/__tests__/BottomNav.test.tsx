import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import BottomNav from "@/components/BottomNav";

const navigation = vi.hoisted(() => ({ pathname: "/", push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  navigation.pathname = "/";
  navigation.push.mockReset();
});

function renderNav(props: Partial<React.ComponentProps<typeof BottomNav>> = {}) {
  const handlers = { onMoreClick: vi.fn(), onSearchClick: vi.fn() };
  render(<BottomNav moreOpen={false} keyboardOpen={false} {...handlers} {...props} />);
  return handlers;
}

describe("BottomNav", () => {
  it("renders the four tabs, More and a separate Search button", () => {
    renderNav();
    for (const name of ["Home", "Money", "Spend", "Invest"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  });

  it("marks the tab that owns the current route", () => {
    navigation.pathname = "/money/accounts";
    renderNav();
    expect(screen.getByRole("link", { name: "Money" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("leaves tabs unmarked for routes that live under More", () => {
    navigation.pathname = "/credit";
    renderNav();
    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("opens More and Search through callbacks", () => {
    const { onMoreClick, onSearchClick } = renderNav();
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(onMoreClick).toHaveBeenCalledTimes(1);
    expect(onSearchClick).toHaveBeenCalledTimes(1);
  });

  it("reflects the More sheet state", () => {
    navigation.pathname = "/money/transactions";
    renderNav({ moreOpen: true });
    expect(screen.getByRole("button", { name: "More" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Money" })).not.toHaveAttribute("aria-current");
  });

  it("scrolls to top instead of navigating when the current tab is tapped", () => {
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    navigation.pathname = "/";
    renderNav();
    const notPrevented = fireEvent.click(screen.getByRole("link", { name: "Home" }));
    expect(notPrevented).toBe(false);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });

  it("is inert and hidden while the keyboard is open", () => {
    renderNav({ keyboardOpen: true });
    const nav = screen.getByRole("navigation", { hidden: true });
    expect(nav).toHaveAttribute("inert");
  });
});
