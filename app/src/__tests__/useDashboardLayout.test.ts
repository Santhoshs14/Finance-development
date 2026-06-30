import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// The hook persists to Firestore only when a user is present. Mocking auth to
// return no user keeps reorder/toggle purely in-memory so we can test the
// ordering/visibility logic without touching Firebase.
vi.mock("@/providers/AuthProvider", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

import {
  useDashboardLayout,
  WIDGET_IDS,
  type WidgetId,
} from "@/hooks/useDashboardLayout";

describe("useDashboardLayout", () => {
  it("starts with the default order and all widgets visible", () => {
    const { result } = renderHook(() => useDashboardLayout());
    expect(result.current.layout.order).toEqual([...WIDGET_IDS]);
    WIDGET_IDS.forEach((id) => expect(result.current.isVisible(id)).toBe(true));
  });

  it("reorder moves a widget after its target and keeps all widgets", () => {
    const { result } = renderHook(() => useDashboardLayout());
    const first = WIDGET_IDS[0];
    const third = WIDGET_IDS[2];

    act(() => result.current.reorder(first, third));

    const order = result.current.layout.order;
    expect(order).toHaveLength(WIDGET_IDS.length);
    expect(new Set(order)).toEqual(new Set(WIDGET_IDS));
    expect(order.indexOf(first)).toBeGreaterThan(order.indexOf(third));
  });

  it("reorder is a no-op when an id is unknown", () => {
    const { result } = renderHook(() => useDashboardLayout());
    act(() =>
      result.current.reorder("does-not-exist" as unknown as WidgetId, WIDGET_IDS[1])
    );
    expect(result.current.layout.order).toEqual([...WIDGET_IDS]);
  });

  it("toggleVisibility hides then shows a widget", () => {
    const { result } = renderHook(() => useDashboardLayout());
    const id = WIDGET_IDS[0];

    act(() => result.current.toggleVisibility(id));
    expect(result.current.isVisible(id)).toBe(false);
    expect(result.current.layout.hidden).toContain(id);

    act(() => result.current.toggleVisibility(id));
    expect(result.current.isVisible(id)).toBe(true);
    expect(result.current.layout.hidden).not.toContain(id);
  });
});
