"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { subscribeDataRefresh } from "./data-refresh";

type Notification = {
  id: string;
  type: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  // Optional metadata fields can be added later for deep links
};

export function NotificationBell() {
  const { apiFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);

  const loadCount = useCallback(async () => {
    try {
      const res = await apiFetch("/notifications/me/unseen-count");
      if (!res.ok) return;
      const data = (await res.json()) as { count: number };
      setUnseenCount(data.count ?? 0);
    } catch {
      // ignore
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadCount();
    const onVis = () => {
      if (document.visibilityState === "visible") void loadCount();
    };
    document.addEventListener("visibilitychange", onVis);
    const unsub = subscribeDataRefresh(() => void loadCount());
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      unsub();
    };
  }, [loadCount]);

  async function loadItems() {
    setLoading(true);
    try {
      const res = await apiFetch("/notifications/me");
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = (await res.json()) as Notification[];
      setItems(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && items.length === 0) {
      await loadItems();
    }
  };

  const markRead = async (id: string) => {
    try {
      const res = await apiFetch(`/notifications/${id}/read`, {
        method: "PATCH"
      });
      if (!res.ok) return;
      setItems((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
      setUnseenCount((c) => (c > 0 ? c - 1 : 0));
    } catch {
      // ignore
    }
  };

  const hasUnseen = unseenCount > 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
        aria-label="Notifications"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.172V11a6 6 0 10-12 0v3.172a2 2 0 01-.586 1.414L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {hasUnseen && (
          <span className="absolute -right-1 -top-1 inline-flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-slate-800 bg-slate-950/95 p-3 text-sm shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Notifications
            </p>
            {loading && (
              <span className="text-[10px] text-slate-500">Loading…</span>
            )}
          </div>
          {items.length === 0 && !loading && (
            <p className="text-xs text-slate-500">No notifications yet.</p>
          )}
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {items.map((n) => {
              const isRead = Boolean(n.readAt);
              const created = new Date(n.createdAt);
              return (
                <li
                  key={n.id}
                  className={`flex items-start justify-between gap-2 rounded-lg px-2 py-2 ${
                    isRead ? "bg-slate-900/40" : "bg-slate-900/80"
                  }`}
                >
                  <div>
                    <p className="text-xs text-slate-300">{n.body}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {created.toLocaleString()}
                    </p>
                  </div>
                  {!isRead && (
                    <button
                      type="button"
                      onClick={() => void markRead(n.id)}
                      className="mt-0.5 rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                    >
                      Mark read
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

