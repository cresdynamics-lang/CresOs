"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";

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
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Login failed");
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
      router.push("/dashboard");
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
    <div className="min-h-screen bg-cres-bg text-cres-text flex flex-col">
      <header className="border-b border-cres-border bg-cres-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="text-sm text-cres-text-muted hover:text-cres-text transition-colors"
          >
            ← Back to home
          </Link>
          <span className="text-sm font-semibold text-cres-text">CresOS</span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <section className="w-full max-w-md">
          <div className="rounded-xl border border-cres-border bg-cres-card p-6 sm:p-8">
            <h1 className="mb-1 text-xl font-semibold text-cres-text">
              Sign in
            </h1>
            <p className="mb-6 text-sm text-cres-text-muted">
              Use your Cres Dynamics account to access your workspace.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="block text-sm">
                <span className="mb-1.5 block text-cres-text-muted">Email</span>
                <input
                  type="email"
                  className="w-full rounded-lg border border-cres-border bg-cres-surface px-3 py-2.5 text-sm text-cres-text placeholder-cres-muted outline-none transition-colors focus:border-cres-accent focus:ring-1 focus:ring-cres-accent"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-cres-text-muted">Password</span>
                <input
                  type="password"
                  className="w-full rounded-lg border border-cres-border bg-cres-surface px-3 py-2.5 text-sm text-cres-text placeholder-cres-muted outline-none transition-colors focus:border-cres-accent focus:ring-1 focus:ring-cres-accent"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              {error && (
                <p className="text-sm text-rose-400" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 inline-flex items-center justify-center rounded-lg bg-cres-accent px-4 py-3 text-sm font-medium text-cres-bg hover:bg-cres-accent-hover transition-colors disabled:opacity-60 disabled:pointer-events-none"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
          <p className="mt-4 text-center text-xs text-cres-muted">
            Don&apos;t have access?{" "}
            <a
              href="https://cresdynamics.com/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cres-accent hover:underline"
            >
              Contact Cres Dynamics
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
