"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import { SettingsPanel } from "./settings-panel";
import { HeaderStatusStrip } from "./header-status";
import { ALL_APP_ROLE_KEYS } from "../lib/app-roles";
import { ring } from "./browser-notify";
import { shouldPlayBrowserSoundForUser } from "../lib/notification-signals";

type NavSection = {
  title: string;
  items: { href: string; label: string; roles: string[] }[];
};

const SIDEBAR_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", roles: [...ALL_APP_ROLE_KEYS] },
      { href: "/schedule", label: "Tasks", roles: ["admin", "director_admin", "developer", "sales", "analyst"] }
    ]
  },
  {
    title: "Community",
    items: [
      { href: "/community", label: "Community", roles: [...ALL_APP_ROLE_KEYS] }
    ]
  },
  {
    title: "Reports",
    items: [
      { href: "/reports", label: "Sales reports", roles: ["admin", "director_admin", "sales"] },
      { href: "/developer-reports", label: "Developer reports", roles: ["admin", "director_admin", "developer"] }
    ]
  },
  {
    title: "Sales",
    items: [
      { href: "/sales", label: "Sales hub", roles: ["admin", "sales", "director_admin", "finance"] },
      { href: "/sales/invoices", label: "Invoices", roles: ["admin", "sales"] },
      { href: "/leads", label: "Leads", roles: ["admin", "director_admin", "sales", "finance"] },
      { href: "/crm", label: "CRM", roles: ["admin", "sales", "director_admin", "finance"] }
    ]
  },
  {
    title: "Delivery",
    items: [
      { href: "/projects", label: "Projects", roles: ["admin", "director_admin", "developer", "sales", "analyst", "finance"] }
    ]
  },
  {
    title: "Finance",
    items: [
      { href: "/finance", label: "Finance", roles: ["admin", "finance", "analyst"] },
      { href: "/approvals", label: "Approvals", roles: ["admin", "director_admin", "finance"] }
    ]
  },
  {
    title: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", roles: ["admin", "director_admin", "finance", "analyst"] }
    ]
  },
  {
    title: "Administration",
    items: [
      { href: "/admin/users", label: "Users", roles: ["admin"] },
      { href: "/admin/org", label: "Departments", roles: ["admin"] },
      { href: "/admin/roles", label: "Roles", roles: ["admin"] }
    ]
  }
];

function roleLabel(key: string): string {
  const labels: Record<string, string> = {
    admin: "Admin",
    director_admin: "Director",
    finance: "Finance",
    developer: "Developer",
    sales: "Sales",
    analyst: "Analyst",
    client: "Client"
  };
  return labels[key] ?? key;
}

type ShellNavItem = { href: string; label: string; roles: string[] };
type ShellNavSection = { title: string; items: ShellNavItem[] };

type SidebarNavContentProps = {
  isSidebarCollapsed: boolean;
  pathname: string;
  roles: string[];
  visibleSections: ShellNavSection[];
  badgeForItem: (href: string, label: string) => { count: number; tone: "rose" | "amber" | "sky" } | null;
  /** Unread DM count from chat API; used to emphasize Community when user is elsewhere. */
  communityChatUnread: number;
  onOpenSettings: () => void;
  onLogout: () => void;
  onNavClick?: () => void;
  showMobileClose?: boolean;
  onMobileClose?: () => void;
};

function SidebarNavContent({
  isSidebarCollapsed,
  pathname,
  roles,
  visibleSections,
  badgeForItem,
  communityChatUnread,
  onOpenSettings,
  onLogout,
  onNavClick,
  showMobileClose,
  onMobileClose
}: SidebarNavContentProps) {
  return (
    <>
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="h-9 w-9 shrink-0 rounded-xl bg-brand/20 ring-2 ring-brand/60" />
          {!isSidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-wide text-brand">CresOS</p>
              <p className="text-[10px] text-slate-400">Operating System for Growth</p>
            </div>
          )}
        </div>
        {showMobileClose ? (
          <button
            type="button"
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label="Close menu"
            onClick={() => onMobileClose?.()}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>

      {!isSidebarCollapsed && (
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {visibleSections.map((section) => (
            <div key={section.title} className="mb-6">
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {section.title}
              </p>
              <nav className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const onCommunity = pathname.startsWith("/community");
                  const isActive =
                    pathname === item.href ||
                    (item.href === "/reports" && pathname.startsWith("/reports")) ||
                    (item.href === "/developer-reports" && pathname.startsWith("/developer-reports")) ||
                    (item.href === "/leads" && pathname.startsWith("/leads")) ||
                    (item.href === "/crm" && pathname.startsWith("/crm")) ||
                    (item.href === "/community" && communityChatUnread > 0 && !onCommunity);
                  const badge = badgeForItem(item.href, item.label);
                  return (
                    <Link
                      key={`${section.title}-${item.href}-${item.label}`}
                      href={item.href}
                      onClick={() => onNavClick?.()}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "border border-brand/40 bg-brand/15 text-brand"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      {item.label}
                      {badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${
                            badge.tone === "rose"
                              ? "bg-rose-500"
                              : badge.tone === "amber"
                                ? "bg-amber-500"
                                : "bg-sky-500"
                          }`}
                          title={`${badge.count} needs attention`}
                        >
                          {badge.count > 99 ? "99+" : badge.count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      )}

      {isSidebarCollapsed && (
        <div className="flex-1 overflow-y-auto px-2 py-4">
          {visibleSections.map((section) => (
            <div key={section.title} className="mb-4">
              <div className="mb-2 text-center text-[8px] font-semibold uppercase tracking-wider text-slate-500">
                {section.title.charAt(0)}
              </div>
              <nav className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const onCommunity = pathname.startsWith("/community");
                  const isActive =
                    pathname === item.href ||
                    (item.href === "/reports" && pathname.startsWith("/reports")) ||
                    (item.href === "/developer-reports" && pathname.startsWith("/developer-reports")) ||
                    (item.href === "/leads" && pathname.startsWith("/leads")) ||
                    (item.href === "/crm" && pathname.startsWith("/crm")) ||
                    (item.href === "/community" && communityChatUnread > 0 && !onCommunity);
                  const badge = badgeForItem(item.href, item.label);
                  return (
                    <Link
                      key={`${section.title}-${item.href}-${item.label}`}
                      href={item.href}
                      onClick={() => onNavClick?.()}
                      className={`relative flex items-center justify-center rounded-lg p-2 text-xs font-medium transition-colors ${
                        isActive
                          ? "border border-brand/40 bg-brand/15 text-brand"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                      title={item.label}
                    >
                      {item.label.charAt(0)}
                      {badge && (
                        <span
                          className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ${
                            badge.tone === "rose"
                              ? "bg-rose-500"
                              : badge.tone === "amber"
                                ? "bg-amber-500"
                                : "bg-sky-500"
                          }`}
                        />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-slate-800 p-3">
        {!isSidebarCollapsed && (
          <div className="mb-2 flex flex-wrap gap-1">
            {roles.map((r) => (
              <span key={r} className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                {roleLabel(r)}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              onOpenSettings();
              onNavClick?.();
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Settings"
            title={isSidebarCollapsed ? "Settings" : ""}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {!isSidebarCollapsed && <span>Settings</span>}
          </button>
          <button
            type="button"
            onClick={() => {
              onNavClick?.();
              onLogout();
            }}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            title={isSidebarCollapsed ? "Sign out" : ""}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { auth, setAuth, apiFetch } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const roles = auth.roleKeys;
  const [overdueCount, setOverdueCount] = useState(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [unseenCount, setUnseenCount] = useState(0);
  const [communityChatUnread, setCommunityChatUnread] = useState(0);
  const [devProjectsNeedAttention, setDevProjectsNeedAttention] = useState(0);
  const [devReportReminderDue, setDevReportReminderDue] = useState(false);
  const [unreadByKeyword, setUnreadByKeyword] = useState<Record<string, number>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<"preferences" | "account">("account");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const canSeeApprovals = useMemo(
    () => roles.some((r) => ["admin", "director_admin", "finance"].includes(r)),
    [roles]
  );

  const lastSeenKey = (section: string) => `cresos_sidebar_seen_${section}`;
  const getLastSeen = (section: string): number => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(lastSeenKey(section));
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  };
  const setLastSeen = (section: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(lastSeenKey(section), String(Date.now()));
  };

  useEffect(() => {
    if (!roles.some((r) => ["sales", "director_admin", "admin"].includes(r))) return;
    let cancelled = false;
    apiFetch("/reports/alarms/overdue")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled && data?.overdue?.length != null) setOverdueCount(data.overdue.length);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [roles, apiFetch]);

  const prevUnreadIdsRef = useRef<Set<string>>(new Set());
  const firstNotificationPollRef = useRef(true);
  const loadSidebarAttention = useCallback(async () => {
    try {
      const needsDevAttention = roles.includes("developer");
      const [nCountRes, nRes, aRes, attnRes, convRes] = await Promise.all([
        apiFetch("/notifications/me/unseen-count"),
        apiFetch("/notifications/me"),
        canSeeApprovals ? apiFetch("/finance/approvals") : Promise.resolve(null as unknown as Response),
        needsDevAttention ? apiFetch("/dashboard/attention") : Promise.resolve(null as unknown as Response),
        apiFetch("/chat-community/conversations")
      ]);

      if (nCountRes.ok) {
        const j = (await nCountRes.json()) as { count?: number };
        const next = j.count ?? 0;
        setUnseenCount(next);
      }

      if (nRes.ok) {
        const list = (await nRes.json()) as {
          id: string;
          type?: string;
          subject?: string | null;
          body?: string;
          createdAt?: string;
          readAt?: string | null;
        }[];
        const unread = list.filter((x) => !x.readAt);
        const unreadIds = new Set(unread.map((x) => x.id));
        if (firstNotificationPollRef.current) {
          firstNotificationPollRef.current = false;
          prevUnreadIdsRef.current = unreadIds;
        } else {
          const newcomers = unread.filter((x) => !prevUnreadIdsRef.current.has(x.id));
          const ringForAttention = newcomers.some((n) =>
            shouldPlayBrowserSoundForUser(
              {
                type: n.type,
                subject: n.subject,
                body: n.body
              },
              roles
            )
          );
          if (ringForAttention) ring();
          prevUnreadIdsRef.current = unreadIds;
        }
        const blob = unread
          .map((n) => `${n.type ?? ""} ${n.body ?? ""}`.toLowerCase())
          .join("\n");
        // Very lightweight keyword buckets to show “something needs attention” per section.
        // This uses only unread notification text; it’s safe even if we don’t have per-module counts.
        const buckets: Array<[string, string[]]> = [
          ["projects", ["project", "milestone"]],
          ["crm", ["crm", "client"]],
          ["leads", ["lead", "deal", "pipeline"]],
          ["finance", ["invoice", "payment", "expense", "payout", "approval"]],
          ["reports", ["report"]]
        ];
        const next: Record<string, number> = {};
        for (const [k, words] of buckets) {
          next[k] = words.some((w) => blob.includes(w)) ? 1 : 0; // dot-level signal
        }
        setUnreadByKeyword(next);
      }

      if (canSeeApprovals && aRes && (aRes as any).ok) {
        const list = (await (aRes as any).json()) as { status: string; entityType: string }[];
        const pending = list.filter(
          (a) =>
            a.status === "pending" &&
            (a.entityType === "expense" || a.entityType === "payout" || a.entityType === "invoice")
        ).length;
        // Only show as "attention" if user hasn't opened Approvals since last time.
        const seenAt = getLastSeen("approvals");
        setPendingApprovalsCount(seenAt > 0 ? 0 : pending);
      } else if (!canSeeApprovals) {
        setPendingApprovalsCount(0);
      }

      if (needsDevAttention && attnRes && (attnRes as any).ok) {
        const j = (await (attnRes as any).json()) as {
          stats?: { tasksOverdue?: number; needsAttentionCount?: number };
          projectsNeedingReview?: unknown[];
          handoffRequestsReceived?: unknown[];
          reportReminderDue?: boolean;
        };
        const projectsCount =
          (Array.isArray(j.projectsNeedingReview) ? j.projectsNeedingReview.length : 0) +
          (Array.isArray(j.handoffRequestsReceived) ? j.handoffRequestsReceived.length : 0);
        const tasksOverdue = j.stats?.tasksOverdue ?? 0;
        setDevProjectsNeedAttention(projectsCount + tasksOverdue);
        setDevReportReminderDue(j.reportReminderDue === true);
      } else if (!needsDevAttention) {
        setDevProjectsNeedAttention(0);
        setDevReportReminderDue(false);
      }

      if (convRes.ok) {
        const j = (await convRes.json()) as {
          data?: { conversations?: { unreadCount?: number }[] };
        };
        const arr = j.data?.conversations ?? [];
        setCommunityChatUnread(
          arr.reduce((sum, c) => sum + (typeof c.unreadCount === "number" ? c.unreadCount : 0), 0)
        );
      } else {
        setCommunityChatUnread(0);
      }
    } catch {
      // ignore
    }
  }, [apiFetch, canSeeApprovals, roles]);

  // When user opens a section, treat it as "attended": clear that section's badge by
  // (a) marking related notifications as read (when possible) and (b) storing last-seen timestamp.
  useEffect(() => {
    const seg = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean)[0] ?? "";
    const section =
      seg === "developer-reports" ? "reports" :
      seg === "schedule" ? "tasks" :
      seg === "community" ? "community" :
      seg === "approvals" ? "approvals" :
      seg === "reports" ? "reports" :
      seg === "projects" ? "projects" :
      seg === "crm" ? "crm" :
      seg === "leads" ? "leads" :
      seg === "finance" ? "finance" :
      "";
    if (!section) return;

    setLastSeen(section);

    const keywords: Record<string, string[]> = {
      community: ["community", "chat", "message"],
      tasks: ["task", "assigned", "due", "schedule"],
      projects: ["project", "milestone"],
      crm: ["crm", "client"],
      leads: ["lead", "deal", "pipeline"],
      finance: ["invoice", "payment", "expense", "payout", "approval"],
      reports: ["report"]
    };

    void (async () => {
      try {
        const res = await apiFetch("/notifications/me");
        if (!res.ok) return;
        const list = (await res.json()) as { id: string; type?: string; body?: string; readAt?: string | null }[];
        const words = keywords[section] ?? [];
        const unread = list.filter((n) => !n.readAt);
        const toMark = unread.filter((n) => {
          const t = `${n.type ?? ""} ${n.body ?? ""}`.toLowerCase();
          return words.some((w) => t.includes(w));
        });
        await Promise.all(
          toMark.map((n) => apiFetch(`/notifications/${n.id}/read`, { method: "PATCH" }).catch(() => null))
        );
        await loadSidebarAttention();
      } catch {
        // ignore
      }
    })();
  }, [pathname, apiFetch, loadSidebarAttention]);

  useEffect(() => {
    void loadSidebarAttention();
    const t = window.setInterval(() => void loadSidebarAttention(), 30_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void loadSidebarAttention();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadSidebarAttention]);

  const badgeForItem = (href: string, label: string): { count: number; tone: "rose" | "amber" | "sky" } | null => {
    // No badges on the dashboard (requested)
    if (href === "/dashboard") return null;

    // Hard counts (DB / alarms)
    if (href === "/approvals" && pendingApprovalsCount > 0) {
      return { count: pendingApprovalsCount, tone: pendingApprovalsCount > 3 ? "amber" : "sky" };
    }
    if (href === "/reports" && overdueCount > 0) {
      const seenAt = getLastSeen("reports");
      return seenAt > 0 ? null : { count: overdueCount, tone: "rose" };
    }
    if (href === "/community" && communityChatUnread > 0) {
      return { count: communityChatUnread, tone: "sky" };
    }
    if (href === "/projects" && devProjectsNeedAttention > 0 && roles.includes("developer")) {
      const seenAt = getLastSeen("projects");
      return seenAt > 0 ? null : { count: devProjectsNeedAttention, tone: "amber" };
    }
    if (href === "/developer-reports" && devReportReminderDue && roles.includes("developer")) {
      const seenAt = getLastSeen("reports");
      return seenAt > 0 ? null : { count: 1, tone: "rose" };
    }

    // Dot-level attention for the rest (based on unread notifications text)
    const key = href.split("/").filter(Boolean)[0] || label.toLowerCase();
    const k = key.toLowerCase();
    const dot =
      (k.includes("project") && unreadByKeyword.projects) ||
      (k === "crm" && unreadByKeyword.crm) ||
      (k === "leads" && unreadByKeyword.leads) ||
      (k === "finance" && unreadByKeyword.finance) ||
      (k === "reports" && unreadByKeyword.reports);
    if (dot) return { count: 1, tone: "sky" };
    return null;
  };

  const visibleSections = SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        item.roles.some((r) => roles.includes(r))
    )
  })).filter((s) => s.items.length > 0);

  const handleLogout = () => {
    setAuth({
      accessToken: null,
      refreshToken: null,
      roleKeys: [],
      userId: undefined,
      userEmail: undefined,
      userName: undefined,
      orgId: undefined,
      orgName: undefined,
      orgSlug: undefined
    });
    router.replace("/login");
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    firstNotificationPollRef.current = true;
    prevUnreadIdsRef.current = new Set();
  }, [auth.userId]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  // Check if current page should be fullscreen
  const isFullscreenPage = pathname === '/community';

  const shellNavProps = {
    pathname,
    roles,
    visibleSections,
    badgeForItem,
    communityChatUnread,
    onOpenSettings: () => setSettingsOpen(true),
    onLogout: handleLogout
  };

  const hideTopHeader = isFullscreenPage && isFullscreen;

  return (
    <div className={`flex h-dvh min-h-0 overflow-hidden ${isFullscreenPage && isFullscreen ? "bg-slate-950" : ""}`}>
      {mobileNavOpen && !(isFullscreenPage && isFullscreen) && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-950/70"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute left-0 top-0 z-10 flex h-full w-[min(20rem,92vw)] max-w-sm flex-col border-r border-slate-800 bg-slate-900 shadow-2xl">
            <SidebarNavContent
              {...shellNavProps}
              isSidebarCollapsed={false}
              onNavClick={() => setMobileNavOpen(false)}
              showMobileClose
              onMobileClose={() => setMobileNavOpen(false)}
            />
          </aside>
        </div>
      )}

      <aside
        className={`hidden shrink-0 flex-col border-r border-slate-800 bg-slate-900/50 transition-all duration-300 lg:flex ${
          isSidebarCollapsed ? "w-16" : "w-64"
        } ${isFullscreenPage && isFullscreen ? "!hidden" : ""}`}
      >
        <SidebarNavContent {...shellNavProps} isSidebarCollapsed={isSidebarCollapsed} />
      </aside>

      <button
        type="button"
        onClick={toggleSidebar}
        className={`fixed top-4 z-30 hidden rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 transition-all duration-300 hover:bg-slate-700 hover:text-slate-200 lg:block ${
          isFullscreenPage && isFullscreen ? "hidden" : ""
        }`}
        style={{ left: isSidebarCollapsed ? "4rem" : "16rem" }}
        title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isSidebarCollapsed ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          )}
        </svg>
      </button>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} initialTab={settingsInitialTab} />

      {/* Main content: on small screens the top bar is fixed while content scrolls; lg+ keep in-flow + sticky. */}
      <main
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overflow-x-hidden transition-all duration-300 ${
          isFullscreenPage && isFullscreen ? "max-w-none" : ""
        }`}
      >
        <header
          className={`z-20 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2.5 backdrop-blur-sm sm:gap-3 sm:px-6 sm:py-3 ${
            hideTopHeader
              ? "hidden"
              : "max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:z-50 max-lg:pt-[env(safe-area-inset-top,0px)] lg:relative lg:top-auto lg:bg-slate-950/95"
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-slate-200 lg:hidden"
              aria-label="Open menu"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0 text-xs font-medium uppercase tracking-wide text-slate-500">
              <span className="truncate text-slate-400">{auth.orgName?.trim() || "Workspace"}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <HeaderStatusStrip />
            
            {/* Fullscreen Toggle */}
            {isFullscreenPage && (
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isFullscreen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  )}
                </svg>
              </button>
            )}
          </div>
        </header>
        <div
          className={`min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden ${
            isFullscreenPage
              ? hideTopHeader
                ? "mx-0 flex flex-col overflow-hidden px-0 py-0"
                : "mx-0 flex max-lg:pt-[calc(3.75rem+env(safe-area-inset-top,0px))] flex-col overflow-hidden px-0 py-0 lg:pt-0"
              : "mx-auto overflow-y-auto overscroll-y-contain px-3 pb-4 sm:px-6 sm:pb-6 max-lg:pt-[calc(3.75rem+env(safe-area-inset-top,0px)+1rem)] lg:py-6"
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
