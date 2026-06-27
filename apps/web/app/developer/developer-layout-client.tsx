"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { DeveloperGlassCanvas } from "../../components/developer/developer-glass-ui";
import { DeveloperNav, DeveloperSideNav } from "./developer-nav";

export function DeveloperLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { auth, hydrated } = useAuth();
  const canAccess =
    auth.roleKeys.includes("developer") && !auth.roleKeys.includes("admin");

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccess) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccess, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div className="developer-glass flex h-full items-center justify-center bg-[#080b12] text-sm text-slate-400">
        Loading developer workspace…
      </div>
    );
  }

  if (!canAccess) return null;

  return (
    <DeveloperGlassCanvas className="h-full min-h-0 flex-1 gap-0 p-0">
      <div className="relative z-[1] flex h-full min-h-0 w-full flex-1 overflow-hidden">
        <aside className="hidden w-[13.5rem] shrink-0 flex-col border-r border-white/10 bg-black/20 backdrop-blur-xl md:flex">
          <div className="border-b border-white/10 px-4 py-4">
            <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-400/90">
              Developer
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DeveloperSideNav />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-white/10 bg-black/20 px-2 py-2 backdrop-blur-md md:hidden">
            <DeveloperNav />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            {children}
          </div>
        </div>
      </div>
    </DeveloperGlassCanvas>
  );
}
