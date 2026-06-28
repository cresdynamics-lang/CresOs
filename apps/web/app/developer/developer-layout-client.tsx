"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { DeveloperGlassCanvas } from "../../components/developer/developer-glass-ui";
import { WorkspaceAside } from "../../components/workspace/workspace-aside";
import { DeveloperSideNav } from "./developer-nav";

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
        <WorkspaceAside
          title="Developer"
          subtitle="Tasks, projects & reports"
          themeKey="developer"
          className="hidden w-[15rem] md:flex"
        >
          <DeveloperSideNav />
        </WorkspaceAside>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </div>
      </div>
    </DeveloperGlassCanvas>
  );
}
