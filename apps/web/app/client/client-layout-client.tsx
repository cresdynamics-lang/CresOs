"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";

export function ClientLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { auth, hydrated } = useAuth();
  const isClient = auth.roleKeys.includes("client");

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!isClient) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, isClient, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div className="client-portal flex h-full items-center justify-center bg-[#0a0d14] text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  if (!isClient) return null;

  return (
    <div className="client-portal flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#0a0d14]">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-8 sm:py-8">{children}</div>
    </div>
  );
}
