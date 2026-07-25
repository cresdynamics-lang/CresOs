"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { adminNeu } from "../../components/admin/admin-theme";
import { AdminNav, AdminSideNav } from "./admin-nav";
import { HeaderProfileMenu } from "../../components/workspace/header-profile-menu";

function pageTitle(pathname: string | null): string {
  if (!pathname) return "Dashboard";
  if (pathname === "/admin" || pathname === "/admin/") return "Dashboard";
  if (pathname.startsWith("/admin/users")) return "Users";
  if (pathname.startsWith("/admin/org")) return "Departments";
  if (pathname.startsWith("/admin/roles")) return "Roles";
  if (pathname.startsWith("/admin/email-automation")) return "Email AI";
  if (pathname.startsWith("/admin/ai-command")) return "AI Command";
  if (pathname.startsWith("/admin/client-portal")) return "Client portal";
  if (pathname.startsWith("/admin/onboarding")) return "Playbook";
  return "Admin";
}

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { auth, hydrated } = useAuth();
  const canAccess = auth.roleKeys.includes("admin");
  const [search, setSearch] = useState("");

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
    <div
      className={`${adminNeu.workspace} admin-fullscreen ${adminNeu.canvas} flex h-full min-h-0 w-full flex-1 overflow-hidden`}
    >
      {/* Dark GemMatrix sidebar */}
      <aside className="hidden h-full max-h-[100dvh] w-[15.5rem] shrink-0 flex-col bg-[#1C1F2E] text-[#C8CDD8] md:flex">
        <div className="shrink-0 border-b border-[#2A2E3D] px-4 py-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="relative flex h-8 w-8 items-center justify-center" aria-hidden>
              <svg viewBox="0 0 32 32" className="h-7 w-7">
                <path d="M16 2 L30 16 L16 30 L2 16 Z" fill="#F8B042" />
                <path d="M16 8 L24 16 L16 24 L8 16 Z" fill="#1C1F2E" opacity="0.25" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold tracking-tight text-white">Cres Dynamics</p>
              <p className="truncate font-label text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8B93A1]">
                Admin
              </p>
            </div>
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <AdminSideNav />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className={`flex shrink-0 items-center gap-3 px-3 py-2.5 sm:px-5 ${adminNeu.topBar}`}>
          <h1 className="shrink-0 font-display text-lg font-bold tracking-tight text-[#1A1D26] sm:text-xl">
            {pageTitle(pathname)}
          </h1>
          <div className="mx-auto hidden min-w-0 max-w-md flex-1 sm:block">
            <label className="relative block">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#8B93A1]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
                  />
                </svg>
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search here.."
                className="w-full rounded-full border border-[#E5E9EF] bg-[#F4F7F9] py-2 pl-9 pr-12 font-body text-sm font-medium text-[#1A1D26] placeholder:text-[#8B93A1] focus:border-[#2D5A5A] focus:outline-none focus:ring-2 focus:ring-[#2D5A5A]/20"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-label text-[10px] font-bold text-[#8B93A1]">
                ⌘/
              </span>
            </label>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E9EF] bg-white text-[#5B6472] hover:bg-[#F4F7F9]"
              aria-label="Notifications"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0"
                />
              </svg>
            </button>
            <HeaderProfileMenu />
          </div>
        </header>

        <div className="shrink-0 border-b border-[#E5E9EF] bg-white px-3 py-2 md:hidden">
          <AdminNav />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}
