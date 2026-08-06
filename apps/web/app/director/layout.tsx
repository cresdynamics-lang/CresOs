"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { DirectorLayoutClient } from "./director-layout-client";
import { isDirectorOnly } from "../../lib/is-director-only";

/** Chrome for /director/* hubs (CRM, Reports, playbook, messages). */
export default function DirectorSectionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { auth, hydrated } = useAuth();
  const allowed = isDirectorOnly(auth.roleKeys);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!allowed) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, allowed, router]);

  if (!hydrated || !auth.accessToken) {
    return <div className="flex h-full items-center justify-center text-sm text-[#8A8886]">Loading…</div>;
  }
  if (!allowed) return null;

  return <DirectorLayoutClient>{children}</DirectorLayoutClient>;
}
