"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { AuthGlassCanvas, AuthGlassCard, authGlass } from "../../components/auth/auth-glass-ui";

export default function LoginPage() {
  const { setAuth } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
      const res = await fetch(apiBase + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          hint?: string;
          message?: string;
        };
        const parts = [body.error ?? body.message, body.hint].filter(Boolean);
        setError(parts.length ? parts.join(" — ") : "Login failed");
        setLoading(false);
        return;
      }
      const data = await res.json();
      const roleKeys = data.roleKeys ?? [];
      const org = data.org as { id: string; name: string | null; slug: string | null } | undefined;
      setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        roleKeys,
        userId: data.user?.id,
        userEmail: data.user?.email,
        userName: data.user?.name ?? null,
        orgId: data.orgId ?? org?.id,
        orgName: org?.name ?? null,
        orgSlug: org?.slug ?? null
      });
      const isClientOnly =
        roleKeys.includes("client") &&
        !roleKeys.some((r: string) =>
          ["admin", "director_admin", "finance", "sales", "developer", "analyst"].includes(r)
        );
      const isDeveloperOnly =
        roleKeys.includes("developer") &&
        !roleKeys.some((r: string) =>
          ["admin", "director_admin", "finance", "sales", "analyst"].includes(r)
        );
      router.push(isClientOnly ? "/client" : isDeveloperOnly ? "/developer" : "/dashboard");
    } catch (err) {
      const msg =
        err instanceof TypeError && err.message === "Failed to fetch"
          ? "Can't reach the API. Start it: cd apps/api && npm run dev"
          : "Network error. Start the API: cd apps/api && npm run dev";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <AuthGlassCanvas>
      <header className={authGlass.header}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="text-sm text-slate-400 transition-colors hover:text-slate-200"
          >
            ← Back to home
          </Link>
          <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold text-slate-100">
            <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-md">
              <img src="/LOGO.jpg" width={32} height={32} alt="" className="h-7 w-7 rounded-lg" />
            </span>
            CresOS
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-14">
        <section className="w-full max-w-md animate-fade-in">
          <AuthGlassCard>
            <div className="mb-6 flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-gradient-to-br from-sky-500/25 to-emerald-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-md"
                aria-hidden
              >
                <DropletIcon />
              </span>
              <div>
                <h1 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
                  Sign in
                </h1>
                <p className="mt-0.5 text-sm text-slate-400">
                  Use your Cres Dynamics account to access your workspace.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="block text-sm">
                <span className={authGlass.label}>Email</span>
                <input
                  type="email"
                  className={authGlass.input}
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm">
                <span className={authGlass.label}>Password</span>
                <input
                  type="password"
                  className={authGlass.input}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </label>
              <p className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 text-xs leading-relaxed text-slate-500 backdrop-blur-sm">
                Clients: sign in with your email and password as{" "}
                <span className="font-medium text-slate-300">FirstName+project number</span> (e.g.{" "}
                <span className="font-mono text-sky-300/90">Charles13</span>).
              </p>
              {error && (
                <p
                  className="rounded-xl border border-rose-500/25 bg-rose-950/30 px-3 py-2.5 text-sm text-rose-200 backdrop-blur-sm"
                  role="alert"
                >
                  {error}
                </p>
              )}
              <button type="submit" disabled={loading} className={authGlass.button}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </AuthGlassCard>

          <p className={`mt-5 text-center text-xs ${authGlass.muted}`}>
            New database?{" "}
            <Link href="/register" className={authGlass.link}>
              Create a workspace
            </Link>
            {" · "}
            <a
              href="https://cresdynamics.com/contact"
              target="_blank"
              rel="noopener noreferrer"
              className={authGlass.link}
            >
              Contact Cres Dynamics
            </a>
          </p>
          <p className={`mt-6 text-center text-[11px] ${authGlass.muted}`}>
            Built by{" "}
            <a
              href="https://cresdynamics.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-amber-300/90 underline-offset-2 transition-colors hover:text-amber-200 hover:underline"
            >
              Cres Dynamics
            </a>
          </p>
        </section>
      </main>
    </AuthGlassCanvas>
  );
}

function DropletIcon() {
  return (
    <svg className="h-5 w-5 text-sky-200/90" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.69c-3.5 4.02-6 7.14-6 10.31a6 6 0 1 0 12 0c0-3.17-2.5-6.29-6-10.31z" opacity="0.85" />
      <path
        d="M12 2.69c-3.5 4.02-6 7.14-6 10.31a6 6 0 1 0 12 0c0-3.17-2.5-6.29-6-10.31z"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.75"
      />
    </svg>
  );
}
