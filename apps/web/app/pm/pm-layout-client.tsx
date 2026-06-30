"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { pmNeu } from "../../components/pm/pm-theme";
import { PmNav } from "./pm-nav";
import { canAccessPmWorkspace, canAccessKnowledgePool } from "../../lib/is-pm-only";
import { usePathname } from "next/navigation";

export function PmLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { auth, hydrated } = useAuth();
  const pathname = usePathname();
  const canAccess =
    canAccessPmWorkspace(auth.roleKeys) ||
    (canAccessKnowledgePool(auth.roleKeys) && pathname?.startsWith("/pm/knowledge"));

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccess) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccess, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div className={`${pmNeu.workspace} flex h-full items-center justify-center text-sm text-slate-400`}>
        Loading PM workspace…
      </div>
    );
  }

  if (!canAccess) return null;

  return (
    <div
      className={`${pmNeu.workspace} pm-fullscreen ${pmNeu.canvas} flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden`}
    >
      <div className="shrink-0 border-b border-white/[0.06] bg-[#0c1016]/90 px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(0,0,0,0.35)] md:hidden">
        <PmNav />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
    </div>
  );
}
