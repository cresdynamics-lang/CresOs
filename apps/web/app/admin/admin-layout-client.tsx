"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { adminNeu } from "../../components/admin/admin-theme";
import { AdminSideNav } from "./admin-nav";
import { AdminAiChatFab } from "../../components/assistant/admin-ai-chat-fab";
import {
  SidePanelHamburgerButton,
  WorkspaceSidePanelShell
} from "../../components/workspace/workspace-side-panel-shell";

const SIDEBAR_STORAGE_KEY = "cresos.admin.sidebarOpen";

function pageTitle(pathname: string | null): string {
  if (!pathname) return "Dashboard";
  if (pathname === "/admin" || pathname === "/admin/") return "Dashboard";
  if (pathname.startsWith("/admin/organisation") || pathname.startsWith("/admin/organization")) {
    return "Organisation";
  }
  if (pathname.startsWith("/admin/users")) return "Organisation";
  if (pathname === "/admin/org" || pathname.startsWith("/admin/org/")) return "Organisation";
  if (pathname.startsWith("/admin/roles")) return "Organisation";
  if (pathname.startsWith("/admin/ai-command")) return "AI Command";
  if (pathname.startsWith("/admin/onboarding")) return "AI Command";
  if (pathname.startsWith("/admin/email-automation")) return "Email AI";
  if (pathname.startsWith("/admin/client-portal")) return "Organisation";
  if (pathname.startsWith("/admin/management")) return "Management";
  if (pathname.startsWith("/approvals")) return "Management";
  if (pathname.startsWith("/sales")) return "Management";
  if (pathname.startsWith("/leads")) return "Management";
  if (pathname.startsWith("/crm")) return "Management";
  if (pathname.startsWith("/finance") && !pathname.startsWith("/finance/reports")) return "Management";
  if (pathname === "/projects" || pathname.startsWith("/projects/")) return "Management";
  if (pathname.startsWith("/admin/reports")) return "Reports";
  if (pathname.startsWith("/settings/notifications") || pathname.startsWith("/admin/notifications")) {
    return "Notifications";
  }
  if (
    pathname.startsWith("/reports") ||
    pathname.startsWith("/developer-reports") ||
    pathname.startsWith("/director-reports") ||
    pathname.startsWith("/finance/reports")
  ) {
    return "Reports";
  }
  return "Admin";
}

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { auth, hydrated } = useAuth();
  const canAccess = auth.roleKeys.includes("admin");

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccess) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccess, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div
        className={`${adminNeu.workspace} admin-fullscreen ${adminNeu.canvas} flex h-full items-center justify-center font-body text-sm font-medium text-[#5B6472]`}
      >
        Loading admin workspace…
      </div>
    );
  }

  if (!canAccess) return null;

  return (
    <WorkspaceSidePanelShell
      storageKey={SIDEBAR_STORAGE_KEY}
      shellClassName={`${adminNeu.workspace} admin-fullscreen ${adminNeu.canvas}`}
      pageTitle={pageTitle(pathname)}
      fallbackHref="/admin"
      panelWidthClassName="w-[15.5rem]"
      topBarClassName={adminNeu.topBar}
      contentClassName="bg-white px-3 py-3 sm:px-5 sm:py-4 lg:px-6"
      overlayClassName="bg-[#1A1D26]/45"
      titleClassName="min-w-0 shrink truncate font-display text-base font-bold tracking-tight text-[#1A1D26] sm:text-lg"
      fab={<AdminAiChatFab />}
      renderPanel={({ toggleSidebar, closeSidebarMobile }) => (
        <aside className="flex h-full max-h-[100dvh] w-full flex-col bg-[#1C1F2E] text-[#C8CDD8]">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#2A2E3D] px-3 py-3.5">
            <Link
              href="/admin"
              className="flex min-w-0 items-center gap-2.5"
              onClick={closeSidebarMobile}
            >
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden>
                <svg viewBox="0 0 32 32" className="h-7 w-7">
                  <path d="M16 2 L30 16 L16 30 L2 16 Z" fill="#F8B042" />
                  <path d="M16 8 L24 16 L16 24 L8 16 Z" fill="#1C1F2E" opacity="0.25" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold tracking-tight text-white">
                  Cres Dynamics
                </p>
                <p className="truncate font-label text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8B93A1]">
                  Admin
                </p>
              </div>
            </Link>
            <SidePanelHamburgerButton open onClick={toggleSidebar} tone="dark" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <AdminSideNav />
          </div>
        </aside>
      )}
    >
      {children}
    </WorkspaceSidePanelShell>
  );
}
