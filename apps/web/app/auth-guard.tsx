"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import { AppShell } from "./app-shell";

const PUBLIC_PATHS = ["/", "/login", "/register"];

function isPublicPath(path: string): boolean {
  const normalized = path.replace(/\/$/, "") || "/";
  return PUBLIC_PATHS.includes(normalized);
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { auth, hydrated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const hasToken = Boolean(auth.accessToken);
  const isPublic = isPublicPath(pathname);
  const mustRedirectToLogin = !hasToken && !isPublic;
  const mustRedirectToDashboard =
    hasToken && (pathname === "/login" || pathname === "/register" || pathname === "/");

  useEffect(() => {
    if (!hydrated) return;
    if (mustRedirectToLogin) {
      router.replace("/login");
      return;
    }
    if (mustRedirectToDashboard) {
      router.replace("/dashboard");
    }
  }, [hydrated, mustRedirectToLogin, mustRedirectToDashboard, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cres-bg">
        <p className="text-sm text-cres-muted">Loading…</p>
      </div>
    );
  }

  if (!hasToken) {
    if (isPublic) return <>{children}</>;
    return (
      <div className="flex min-h-screen items-center justify-center bg-cres-bg">
        <p className="text-sm text-cres-muted">Redirecting to sign in…</p>
      </div>
    );
  }

  if (pathname === "/login" || pathname === "/" || pathname === "/register") return null;

  return <AppShell>{children}</AppShell>;
}
