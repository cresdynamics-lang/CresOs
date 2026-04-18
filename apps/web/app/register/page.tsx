"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
}

export default function RegisterPage() {
  const { setAuth } = useAuth();
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: orgName.trim(),
          name: name.trim() || undefined,
          email: email.trim(),
          password
        })
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
        accessToken?: string;
        refreshToken?: string;
        roleKeys?: string[];
        orgId?: string;
        org?: { id: string; name: string | null; slug: string | null };
        user?: { id: string; email: string; name: string | null };
      };
      if (!res.ok) {
        const msg = [body.error, body.hint].filter(Boolean).join(" — ") || "Registration failed";
        setError(msg);
        setLoading(false);
        return;
      }
      if (!body.accessToken) {
        setError("Registration succeeded but no token was returned. Check the API.");
        setLoading(false);
        return;
      }
      const org = body.org;
      setAuth({
        accessToken: body.accessToken,
        refreshToken: body.refreshToken ?? null,
        roleKeys: body.roleKeys ?? [],
        userId: body.user?.id,
        userEmail: body.user?.email,
        userName: body.user?.name ?? null,
        orgId: body.orgId ?? org?.id,
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
          <Link href="/login" className="text-sm text-cres-text-muted hover:text-cres-text transition-colors">
            ← Sign in
          </Link>
          <span className="text-sm font-semibold text-cres-text">CresOS</span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <section className="w-full max-w-md">
          <div className="rounded-xl border border-cres-border bg-cres-card p-6 sm:p-8">
            <h1 className="mb-1 text-xl font-semibold text-cres-text">Create workspace</h1>
            <p className="mb-6 text-sm text-cres-text-muted">
              First-time setup on this database. You become the org owner (Director).
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="block text-sm">
                <span className="mb-1.5 block text-cres-text-muted">Organization name</span>
                <input
                  type="text"
                  className="w-full rounded-lg border border-cres-border bg-cres-surface px-3 py-2.5 text-sm text-cres-text outline-none transition-colors focus:border-cres-accent focus:ring-1 focus:ring-cres-accent"
                  placeholder="Acme Inc"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-cres-text-muted">Your name (optional)</span>
                <input
                  type="text"
                  className="w-full rounded-lg border border-cres-border bg-cres-surface px-3 py-2.5 text-sm text-cres-text outline-none transition-colors focus:border-cres-accent focus:ring-1 focus:ring-cres-accent"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-cres-text-muted">Email</span>
                <input
                  type="email"
                  className="w-full rounded-lg border border-cres-border bg-cres-surface px-3 py-2.5 text-sm text-cres-text outline-none transition-colors focus:border-cres-accent focus:ring-1 focus:ring-cres-accent"
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
                  className="w-full rounded-lg border border-cres-border bg-cres-surface px-3 py-2.5 text-sm text-cres-text outline-none transition-colors focus:border-cres-accent focus:ring-1 focus:ring-cres-accent"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
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
                {loading ? "Creating…" : "Create workspace"}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
