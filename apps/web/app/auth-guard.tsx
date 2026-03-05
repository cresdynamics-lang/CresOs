"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import { AppShell } from "./app-shell";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { auth, hydrated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const hasToken = Boolean(auth.accessToken);

  useEffect(() => {
    if (!hydrated) return;
    if (!hasToken && pathname !== "/login" && pathname !== "/") {
      router.replace("/login");
      return;
    }
    if (hasToken && pathname === "/login") {
      router.replace("/dashboard");
      return;
    }
    if (hasToken && pathname === "/") {
      router.replace("/dashboard");
    }
  }, [hydrated, hasToken, pathname, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cres-bg">
        <p className="text-sm text-cres-muted">Loading…</p>
      </div>
    );
  }

  if (!hasToken) {
    if (pathname === "/" || pathname === "/login") return <>{children}</>;
    return null;
  }

  if (pathname === "/login" || pathname === "/") return null;

  return <AppShell>{children}</AppShell>;
}
