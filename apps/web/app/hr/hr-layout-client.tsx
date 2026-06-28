"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { hrNeu } from "../../components/hr/hr-theme";
import { HrNav } from "./hr-nav";
import { canAccessHrWorkspace } from "../../lib/is-hr-only";

export function HrLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { auth, hydrated } = useAuth();
  const canAccess = canAccessHrWorkspace(auth.roleKeys);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccess) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccess, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div className={`${hrNeu.workspace} flex h-full items-center justify-center text-sm text-slate-400`}>
        Loading HR…
      </div>
    );
  }

  if (!canAccess) return null;

  return (
    <div className={`${hrNeu.workspace} hr-fullscreen ${hrNeu.canvas} flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden`}>
      <div className="shrink-0 border-b border-white/[0.06] bg-[#0c1016]/90 px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(0,0,0,0.35)] md:hidden">
        <HrNav />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
