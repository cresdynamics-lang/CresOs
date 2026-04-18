"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-context";
import { subscribeDataRefresh } from "./data-refresh";

type Notification = {
  id: string;
  type: string;
  body: string;
  tier?: string;
  createdAt: string;
  readAt: string | null;
};

export function NotificationBell() {
  const { apiFetch } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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

  const loadItems = useCallback(async () => {
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
  }, [apiFetch]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  useEffect(() => {
    void loadCount();
    const onVis = () => {
      if (document.visibilityState === "visible") void loadCount();
    };
    document.addEventListener("visibilitychange", onVis);
    const unsub = subscribeDataRefresh(() => {
      void loadCount();
      if (open) void loadItems();
    });
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      unsub();
    };
  }, [loadCount, loadItems, open]);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      await loadItems();
    }
  };

  const markRead = async (id: string) => {
    try {
      const res = await apiFetch(`/notifications/${id}/read`, {
        method: "PATCH"
      });
      if (!res.ok) return;
      // Remove from the "unread" list immediately; it remains in History (server-side).
      setItems((prev) => prev.filter((n) => n.id !== id));
      setUnseenCount((c) => (c > 0 ? c - 1 : 0));
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      const res = await apiFetch("/notifications/me/read-all", {
        method: "PATCH"
      });
      if (res.ok) {
        // Clear unread list; history remains server-side.
        setItems([]);
        setUnseenCount(0);
      }
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  };

  const hasUnseen = unseenCount > 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => void toggleOpen()}
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
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="fixed left-2 right-2 top-[3.25rem] z-50 flex max-h-[min(75dvh,32rem)] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950/95 p-3 text-sm shadow-xl backdrop-blur lg:absolute lg:inset-auto lg:right-0 lg:top-full lg:mt-2 lg:w-80 lg:max-h-[min(75vh,32rem)]">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {showHistory ? "Notification history" : "Notifications"}
            </p>
            {loading && (
              <span className="text-[10px] text-slate-500">Loading…</span>
            )}
          </div>
          <div className="mb-3 flex flex-wrap gap-2 border-b border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
            >
              {showHistory ? "Back to unread" : "History"}
            </button>
            <button
              type="button"
              disabled={markingAll || unseenCount === 0}
              onClick={() => void markAllRead()}
              className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              {markingAll ? "Marking…" : "Mark all read"}
            </button>
            <Link
              href="/settings"
              className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
              onClick={() => setOpen(false)}
            >
              Controls
            </Link>
          </div>
          {showHistory ? (
            <NotificationHistory apiFetch={apiFetch} />
          ) : (
            <>
              {items.length === 0 && !loading && (
                <p className="text-xs text-slate-500">No unread notifications.</p>
              )}
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {items.map((n) => {
                  const created = new Date(n.createdAt);
                  return (
                    <li
                      key={n.id}
                      className="flex items-start justify-between gap-2 rounded-lg bg-slate-900/80 px-2 py-2"
                    >
                      <div>
                        {n.tier && (
                          <p className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                            {n.tier}
                          </p>
                        )}
                        <p className="text-xs text-slate-300">{n.body}</p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {created.toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void markRead(n.id)}
                        className="mt-0.5 shrink-0 rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                      >
                        Mark read
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
        </>
      )}
    </div>
  );
}

function NotificationHistory({ apiFetch }: { apiFetch: (input: string, init?: RequestInit) => Promise<Response> }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch("/notifications/me")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled) return;
        const list = (Array.isArray(data) ? (data as Notification[]) : []).filter((n) => Boolean(n.readAt));
        setItems(list);
      })
      .catch(() => setItems([]))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  if (loading) return <p className="text-xs text-slate-500">Loading history…</p>;
  if (items.length === 0) return <p className="text-xs text-slate-500">No history yet.</p>;

  return (
    <ul className="max-h-72 space-y-1 overflow-y-auto">
      {items.map((n) => (
        <li key={n.id} className="rounded-lg bg-slate-900/40 px-2 py-2">
          {n.tier && <p className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-500">{n.tier}</p>}
          <p className="text-xs text-slate-300">{n.body}</p>
          <p className="mt-1 text-[10px] text-slate-500">{new Date(n.createdAt).toLocaleString()}</p>
        </li>
      ))}
    </ul>
  );
}
