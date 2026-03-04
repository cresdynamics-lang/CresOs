"use client";

import { useState } from "react";
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
      const res = await fetch(
        apiBase + "/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Login failed");
        setLoading(false);
        return;
      }
      const data = await res.json();
      const roleKeys = data.roleKeys ?? [];
      setAuth({
        accessToken: data.accessToken,
        roleKeys,
        userId: data.user?.id
      });
      // Role detected from API; redirect to dashboard (content is role-specific)
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
    <div className="flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-md flex flex-col gap-4">
      <div className="shell">
        <h1 className="mb-2 text-lg font-semibold text-slate-50">
          Sign in to CresOS
        </h1>
        <p className="text-sm text-slate-300">
          Use your Cres Dynamics account to access your role-based workspace.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="shell flex flex-col gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-300">Email</span>
          <input
            type="email"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-brand"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-300">Password</span>
          <input
            type="password"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-brand"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p className="text-sm text-rose-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      </section>
    </div>
  );
}

