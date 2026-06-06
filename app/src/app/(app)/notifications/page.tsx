"use client";

import { useState } from "react";
import { useData } from "@/providers/DataProvider";
import { notificationsAPI } from "@/services/api";
import { useTheme } from "@/providers/ThemeProvider";
import EmptyState from "@/components/EmptyState";
import { Bell, CheckCheck, Trash2, AlertTriangle, Info, TrendingUp, CreditCard } from "lucide-react";
import { Button } from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

const ICON_MAP: Record<string, typeof Bell> = {
  budget_alert: AlertTriangle,
  info: Info,
  investment: TrendingUp,
  credit_card: CreditCard,
};

const COLOR_MAP: Record<string, string> = {
  budget_alert: "#f59e0b",
  danger: "#ef4444",
  success: "#10b981",
  info: "#0080ff",
  investment: "#8b5cf6",
  credit_card: "#3b82f6",
};

export default function NotificationsPage() {
  const { notifications } = useData();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setLoading(true);
    try {
      await notificationsAPI.markAllRead();
      toast.success("All marked as read");
    } catch {
      toast.error("Failed to mark as read");
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    setLoading(true);
    try {
      await notificationsAPI.clearAll();
      toast.success("Notifications cleared");
    } catch {
      toast.error("Failed to clear");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsAPI.markRead([id]);
    } catch {
      /* silent */
    }
  };

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No notifications"
        description="You're all caught up! Budget alerts, reminders, and updates will appear here."
      />
    );
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Notifications</h2>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand text-xs font-semibold">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={loading || unreadCount === 0}
            className="gap-1.5 text-xs"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={loading}
            className="gap-1.5 text-xs text-danger border-danger/30 hover:bg-danger/10"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear all
          </Button>
        </div>
      </div>

      {/* Notification list */}
      <div className="space-y-2">
        <AnimatePresence>
          {notifications.map((n, idx) => {
            const Icon = ICON_MAP[n.type] || Bell;
            const color = COLOR_MAP[n.type] || "#6b7280";

            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => !n.read && handleMarkRead(n.id)}
                className={`rounded-xl border p-4 cursor-pointer transition-colors ${
                  n.read
                    ? "border-border bg-card opacity-60"
                    : "border-brand/20 bg-brand/5 hover:bg-brand/10"
                }`}
                style={{ background: !n.read ? (isDark ? "rgba(0,128,255,0.05)" : "rgba(0,128,255,0.03)") : undefined }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: `${color}20` }}
                  >
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-semibold truncate ${n.read ? "text-muted-foreground" : "text-foreground"}`}>
                        {n.title}
                      </p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-brand shrink-0 mt-2" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
