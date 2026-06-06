"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const WIDGET_IDS = [
  "kpi-strip",
  "cash-flow-row",
  "category-row",
  "activity-row",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  "kpi-strip": "KPI Metrics",
  "cash-flow-row": "Cash Flow & Health",
  "category-row": "Categories & Trends",
  "activity-row": "Transactions & Insights",
};

interface DashboardLayout {
  order: WidgetId[];
  hidden: WidgetId[];
}

const DEFAULT_LAYOUT: DashboardLayout = {
  order: [...WIDGET_IDS],
  hidden: [],
};

export function useDashboardLayout() {
  const { user } = useAuth();
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, `users/${user.uid}`)).then((snap) => {
      const data = snap.data();
      if (data?.dashboardLayout) {
        const saved = data.dashboardLayout as DashboardLayout;
        // Merge with defaults in case new widgets were added
        const allIds = new Set(WIDGET_IDS);
        const order = saved.order.filter((id) => allIds.has(id));
        WIDGET_IDS.forEach((id) => { if (!order.includes(id)) order.push(id); });
        setLayout({ order, hidden: saved.hidden || [] });
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [user]);

  const updateLayout = useCallback(async (newLayout: DashboardLayout) => {
    setLayout(newLayout);
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.uid}`), { dashboardLayout: newLayout }, { merge: true });
    } catch {
      // Silent fail — layout will still work in memory
    }
  }, [user]);

  const reorder = useCallback((activeId: WidgetId, overId: WidgetId) => {
    setLayout((prev) => {
      const oldIdx = prev.order.indexOf(activeId);
      const newIdx = prev.order.indexOf(overId);
      if (oldIdx === -1 || newIdx === -1) return prev;
      const order = [...prev.order];
      order.splice(oldIdx, 1);
      order.splice(newIdx, 0, activeId);
      const next = { ...prev, order };
      // Persist async
      if (user) {
        setDoc(doc(db, `users/${user.uid}`), { dashboardLayout: next }, { merge: true }).catch(() => {});
      }
      return next;
    });
  }, [user]);

  const toggleVisibility = useCallback((id: WidgetId) => {
    setLayout((prev) => {
      const hidden = prev.hidden.includes(id)
        ? prev.hidden.filter((h) => h !== id)
        : [...prev.hidden, id];
      const next = { ...prev, hidden };
      if (user) {
        setDoc(doc(db, `users/${user.uid}`), { dashboardLayout: next }, { merge: true }).catch(() => {});
      }
      return next;
    });
  }, [user]);

  const isVisible = useCallback((id: WidgetId) => !layout.hidden.includes(id), [layout.hidden]);

  return { layout, loaded, reorder, toggleVisibility, isVisible, updateLayout };
}
