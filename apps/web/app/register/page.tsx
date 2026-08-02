"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AuthScreenCard,
  AuthScreenShell,
  authScreenField,
  authScreenLabel
} from "../../components/auth/auth-screen-ui";

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
}

const submitPillClass =
  "inline-flex items-center justify-center rounded-full bg-black px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-[#111] disabled:pointer-events-none disabled:opacity-50";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittedPending, setSubmittedPending] = useState(false);

  const showSubmit = password.length > 0 && email.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          password
        })
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
        message?: string;
        pendingApproval?: boolean;
        status?: string;
        accessToken?: string;
      };
      if (!res.ok) {
        const msg = [body.error, body.hint].filter(Boolean).join(" — ") || "Registration failed";
        setError(msg);
        setLoading(false);
        return;
      }

      if (body.accessToken) {
        window.location.href = "/login";
        return;
      }

      setSubmittedPending(true);
      setLoading(false);
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
    <AuthScreenShell backHref="/login" backLabel="← Sign in">
      <section className="flex w-full max-w-md flex-col items-center">
        <AuthScreenCard>
          {submittedPending ? (
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-[#1A1D26]">
                Request received
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[#5B6472]">
                An administrator must approve your account before you can sign in. You will receive a
                confirmation email once approved. Roles are assigned by admin after approval.
              </p>
              <div className="mt-6 flex justify-center">
                <Link href="/login" className={submitPillClass}>
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="font-display text-2xl font-bold tracking-tight text-[#1A1D26]">
                  Request access
                </h1>
                <p className="mt-1 text-sm text-[#5B6472]">
                  Create a password. An admin will approve your account and assign your roles.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label className="block text-sm">
                  <span className={authScreenLabel}>Full name</span>
                  <input
                    type="text"
                    className={authScreenField}
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </label>
                <label className="block text-sm">
                  <span className={authScreenLabel}>Email</span>
                  <input
                    type="email"
                    className={authScreenField}
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </label>
                <label className="block text-sm">
                  <span className={authScreenLabel}>Password</span>
                  <input
                    type="password"
                    className={authScreenField}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </label>
                {error && (
                  <p
                    className="rounded-xl border border-[#FECACA]/80 bg-[#FEF2F2]/85 px-3 py-2.5 text-sm text-[#C62828] backdrop-blur-sm"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                {showSubmit && (
                  <div className="flex justify-center pt-1">
                    <button type="submit" disabled={loading || password.length < 8} className={submitPillClass}>
                      {loading ? "Submitting…" : "Sign up"}
                    </button>
                  </div>
                )}
              </form>
            </>
          )}
        </AuthScreenCard>

        {!submittedPending && (
          <p className="mt-5 text-center text-xs text-[#5B6472]">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[#2D5A5A] underline-offset-2 hover:underline">
              Sign in
            </Link>
          </p>
        )}
        <p className="mt-6 text-center text-[11px] text-[#5B6472]/90">
          Built by{" "}
          <a
            href="https://cresdynamics.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#2D5A5A] underline-offset-2 hover:underline"
          >
            Cres Dynamics
          </a>
        </p>
      </section>
    </AuthScreenShell>
  );
}
